const path = require('path');
const fs = require('fs');

// Load main meddy handler
const connHandler = require('../start/meddy');

function createMockConn() {
    const sentMessages = [];
    return {
        user: { id: '256702662846@s.whatsapp.net', name: 'Terminal Vast' },
        decodeJid: (jid) => jid ? jid.split(':')[0] + '@s.whatsapp.net' : '',
        sendMessage: async (chatId, content, options) => {
            sentMessages.push({ chatId, content, options });
            return { key: { remoteJid: chatId, id: 'MOCK_MSG_' + Date.now() } };
        },
        sendPresenceUpdate: async () => {},
        groupMetadata: async (chatId) => ({
            id: chatId,
            subject: 'Test Group',
            participants: [
                { id: '256702662846@s.whatsapp.net', admin: 'superadmin' },
                { id: '1234567890@s.whatsapp.net', admin: null }
            ]
        }),
        ev: {
            on: () => {},
            off: () => {},
            emit: () => {}
        },
        getSentMessages: () => sentMessages
    };
}

function createMockMessage(body, sender = '256702662846@s.whatsapp.net', isGroup = false) {
    const chat = isGroup ? '120363000000000000@g.us' : sender;
    return {
        key: {
            remoteJid: chat,
            fromMe: false,
            id: 'MSG_' + Date.now(),
            participant: isGroup ? sender : undefined
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Tester',
        chat: chat,
        from: chat,
        sender: sender,
        isGroup: isGroup,
        mtype: 'conversation',
        body: body,
        text: body,
        message: { conversation: body }
    };
}

async function withTimeout(promise, ms = 10000) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runTestSuite() {
    console.log("==================================================");
    console.log("   TERMINAL VAST COMMAND AUDIT & TEST RUNNER      ");
    console.log("==================================================\n");

    let totalPassed = 0;
    let totalFailed = 0;

    async function testCommand(testName, body, sender = '256702662846@s.whatsapp.net', isGroup = false) {
        const mockConn = createMockConn();
        const mockMsg = createMockMessage(body, sender, isGroup);
        const mek = { key: mockMsg.key, message: mockMsg.message };

        try {
            await withTimeout(connHandler(mockConn, mockMsg, { messages: [mek] }, mek, {}), 10000);
            const sent = mockConn.getSentMessages();
            console.log(`[PASS] ${testName} (Sent ${sent.length} response(s))`);
            totalPassed++;
        } catch (err) {
            console.log(`[FAIL/TIMEOUT] ${testName}: ${err.message || err}`);
            totalFailed++;
        }
    }

    console.log("--- 1. Testing Basic & Information Commands ---");
    await testCommand("Ping Command", ".ping");
    await testCommand("Alive Command", ".alive");
    await testCommand("Owner Info Command", ".owner");
    await testCommand("Runtime Command", ".runtime");

    console.log("\n--- 2. Testing AI Commands ---");
    await testCommand("Venice AI Command", ".venice What is 2+2?");
    await testCommand("Mistral AI Command", ".mistral Hello");
    await testCommand("AI Command without args", ".venice");

    console.log("\n--- 3. Testing Downloader & Search Commands ---");
    await testCommand("Playstore Search Command", ".playstore whatsapp");
    await testCommand("Playstore Search without args", ".playstore");
    await testCommand("Lyrics Command", ".lyrics shape of you");
    await testCommand("Lyrics without args", ".lyrics");
    await testCommand("Pinterest Image Command", ".pinterest cute cat");
    await testCommand("Pinterest without args", ".pinterest");

    console.log("\n--- 4. Testing Owner & Permission Security ---");
    await testCommand("Owner Mode Command (Authorized)", ".mode public", "256702662846@s.whatsapp.net");
    await testCommand("Owner Mode Command (Unauthorized)", ".mode public", "999999999@s.whatsapp.net");
    await testCommand("Eval Exec Command (Authorized)", "X 2+2", "256702662846@s.whatsapp.net");
    await testCommand("Eval Exec Command (Unauthorized)", "X 2+2", "999999999@s.whatsapp.net");

    console.log("\n--- 5. Testing Group & Admin Commands ---");
    await testCommand("Group Tagall (Group & Admin)", ".tagall", "256702662846@s.whatsapp.net", true);
    await testCommand("Group Tagall (Private Chat)", ".tagall", "256702662846@s.whatsapp.net", false);

    console.log("\n--- 6. Testing Utility & Fun Commands ---");
    await testCommand("Advice Command", ".advice");
    await testCommand("Motivate Command", ".motivate");

    console.log("\n==================================================");
    console.log(`TEST RESULTS: ${totalPassed} Passed, ${totalFailed} Failed`);
    console.log("==================================================");

    process.exit(totalFailed > 0 ? 1 : 0);
}

runTestSuite();
