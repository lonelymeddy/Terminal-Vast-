const assert = require('assert');
const {
    normalizeJid,
    extractGroupInviteCode,
    resolveGroupFromInvite,
    findAdminConnection,
    demoteAdmins,
    promoteUser,
    lockdownGroup,
    applyBotAdminOverride,
    executeTakeover
} = require('../start/lib/takeover');

async function runTests() {
    console.log("Running Takeover Unit Tests...");

    // Test 1: normalizeJid
    assert.strictEqual(normalizeJid('123456789:12@s.whatsapp.net'), '123456789@s.whatsapp.net');
    assert.strictEqual(normalizeJid('123456789'), '123456789@s.whatsapp.net');
    assert.strictEqual(normalizeJid(''), '');
    console.log("✓ normalizeJid passed");

    // Test 2: extractGroupInviteCode
    assert.strictEqual(extractGroupInviteCode('https://chat.whatsapp.com/ExAmPlELiNkCode123456'), 'ExAmPlELiNkCode123456');
    assert.strictEqual(extractGroupInviteCode('ExAmPlELiNkCode123456'), 'ExAmPlELiNkCode123456');
    assert.strictEqual(extractGroupInviteCode('invalid link'), null);
    console.log("✓ extractGroupInviteCode passed");

    // Test 3: applyBotAdminOverride
    global.db = { data: {} };
    const testGroup = '1234567890@g.us';
    const testUser = '9876543210@s.whatsapp.net';
    applyBotAdminOverride(testGroup, testUser);
    assert.strictEqual(global.db.data.chats[testGroup].botAdminOverride, true);
    assert.ok(global.db.data.chats[testGroup].takeoverAdmins.includes(testUser));
    assert.strictEqual(global.db.data.groups[testGroup].botAdminOverride, true);
    assert.ok(global.db.data.groups[testGroup].takeoverAdmins.includes(testUser));
    console.log("✓ applyBotAdminOverride passed");

    // Test 4: findAdminConnection with mock socket where primary is admin
    const mockPrimaryConn = {
        user: { id: '111111@s.whatsapp.net' },
        groupMetadata: async (jid) => ({
            id: jid,
            subject: 'Test Group',
            participants: [
                { id: '111111@s.whatsapp.net', admin: 'admin' },
                { id: '222222@s.whatsapp.net', admin: 'admin' },
                { id: '333333@s.whatsapp.net', admin: null }
            ]
        })
    };

    const res1 = await findAdminConnection(mockPrimaryConn, testGroup);
    assert.strictEqual(res1.isAdmin, true);
    assert.strictEqual(res1.socket, mockPrimaryConn);
    console.log("✓ findAdminConnection (primary admin) passed");

    // Test 5: findAdminConnection with mock socket where sub-bot is admin
    const mockSubSocket = {
        user: { id: '222222@s.whatsapp.net' }
    };
    const mockNonAdminConn = {
        user: { id: '999999@s.whatsapp.net' },
        client: { 'sub1': mockSubSocket },
        groupMetadata: async (jid) => ({
            id: jid,
            subject: 'Test Group',
            participants: [
                { id: '111111@s.whatsapp.net', admin: null },
                { id: '222222@s.whatsapp.net', admin: 'admin' },
                { id: '333333@s.whatsapp.net', admin: null }
            ]
        })
    };

    const res2 = await findAdminConnection(mockNonAdminConn, testGroup);
    assert.strictEqual(res2.isAdmin, true);
    assert.strictEqual(res2.socket, mockSubSocket);
    console.log("✓ findAdminConnection (sub-bot admin fallback) passed");

    // Test 6: demoteAdmins
    let demotedJids = [];
    const mockAdminSocket = {
        groupParticipantsUpdate: async (jid, participants, action) => {
            if (action === 'demote') {
                demotedJids.push(...participants);
            }
        }
    };
    const participantsToTest = [
        { id: 'admin1@s.whatsapp.net', admin: 'admin' },
        { id: 'admin2@s.whatsapp.net', admin: 'admin' },
        { id: 'bot@s.whatsapp.net', admin: 'admin' }
    ];
    const demotedCount = await demoteAdmins(mockAdminSocket, testGroup, participantsToTest, ['bot@s.whatsapp.net']);
    assert.strictEqual(demotedCount, 2);
    assert.deepStrictEqual(demotedJids, ['admin1@s.whatsapp.net', 'admin2@s.whatsapp.net']);
    console.log("✓ demoteAdmins passed");

    // Test 7: executeTakeover in non-admin scenario (graceful execution)
    let sentMessages = [];
    const mockConnTakeover = {
        user: { id: 'bot@s.whatsapp.net' },
        sendMessage: async (jid, content) => {
            sentMessages.push({ jid, content });
            return { key: {} };
        },
        groupMetadata: async (jid) => ({
            id: jid,
            subject: 'Non-Admin Group',
            participants: [
                { id: 'otherAdmin@s.whatsapp.net', admin: 'admin' },
                { id: 'bot@s.whatsapp.net', admin: null },
                { id: 'user123@s.whatsapp.net', admin: null }
            ]
        }),
        groupParticipantsUpdate: async () => {
            throw new Error('403 Forbidden - Not admin');
        },
        groupSettingUpdate: async () => {},
        groupRevokeInvite: async () => {}
    };

    const mockMsg = {
        isGroup: true,
        chat: testGroup,
        sender: 'user123@s.whatsapp.net'
    };

    await executeTakeover(mockConnTakeover, mockMsg, { prefix: '.', args: ['on'], text: 'on' });
    assert.ok(sentMessages.length >= 2);
    const lastMsg = sentMessages[sentMessages.length - 1].content.text;
    assert.ok(lastMsg.includes('TAKEOVER PROCESS EXECUTED'));
    assert.ok(lastMsg.includes('Bot Admin Override Enabled'));
    console.log("✓ executeTakeover non-admin scenario passed");

    console.log("\nAll Takeover Unit Tests Passed Successfully!");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
