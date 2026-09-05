/**
 * Takeover Module for Meddy / Terminal Vast
 * Handles group takeover operations, fallback admin elevation, and security locking.
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes a JID string to standard format.
 */
function normalizeJid(jid) {
    if (!jid) return '';
    if (typeof jid !== 'string') return '';
    let cleaned = jid.split(':')[0];
    if (!cleaned.includes('@')) {
        cleaned = cleaned + '@s.whatsapp.net';
    }
    return cleaned.trim();
}

/**
 * Extracts a WhatsApp group invite code from text or link.
 */
function extractGroupInviteCode(text) {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,26})/i);
    if (match && match[1]) {
        return match[1];
    }
    // Check if input itself is a raw 20-26 char invite code
    const rawMatch = text.trim().match(/^([0-9A-Za-z]{20,26})$/);
    if (rawMatch && rawMatch[1]) {
        return rawMatch[1];
    }
    return null;
}

/**
 * Resolves target group JID from invite code.
 */
async function resolveGroupFromInvite(conn, inviteCode) {
    try {
        let groupJid = await conn.groupAcceptInvite(inviteCode);
        if (groupJid) {
            if (!groupJid.endsWith('@g.us')) groupJid += '@g.us';
            return groupJid;
        }
    } catch (e) {
        // If already in group or accept fails, try getting invite info
        try {
            const info = await conn.groupGetInviteInfo(inviteCode);
            if (info && info.id) {
                return info.id.endsWith('@g.us') ? info.id : info.id + '@g.us';
            }
        } catch (err) {
            throw new Error(`Could not resolve group from invite link: ${e.message || e}`);
        }
    }
    throw new Error('Unable to resolve group JID from invite link.');
}

/**
 * Finds an active connection (primary socket or connected sub-bots/jadibots) that has admin rights in the group.
 */
async function findAdminConnection(conn, groupJid) {
    let metadata = null;
    try {
        metadata = await conn.groupMetadata(groupJid);
    } catch (err) {
        // Fallback metadata empty
    }

    const participants = metadata?.participants || [];

    const isParticipantAdmin = (socket) => {
        if (!socket?.user?.id) return false;
        const botJid = normalizeJid(socket.user.id);
        const botLid = botJid.replace('@s.whatsapp.net', '@lid');
        const p = participants.find(part => {
            const pid = normalizeJid(part.id || part.jid || '');
            const plid = (part.id || part.jid || '').trim();
            return pid === botJid || plid === botLid;
        });
        return p && (p.admin === 'admin' || p.admin === 'superadmin');
    };

    // Check primary socket first
    if (isParticipantAdmin(conn)) {
        return { socket: conn, isAdmin: true, metadata };
    }

    // Check secondary connected sub-bot clients (jadibots) if available
    if (conn.client && typeof conn.client === 'object') {
        for (let key of Object.keys(conn.client)) {
            const subSocket = conn.client[key];
            if (subSocket && isParticipantAdmin(subSocket)) {
                return { socket: subSocket, isAdmin: true, metadata };
            }
        }
    }

    return { socket: conn, isAdmin: false, metadata };
}

/**
 * Demotes all non-excluded admins in a group.
 */
async function demoteAdmins(activeConn, groupJid, participants, excludeJids = []) {
    const normalizedExcludes = excludeJids.map(normalizeJid);
    let demotedCount = 0;

    for (let p of participants) {
        if (p.admin !== null && p.admin !== undefined) {
            const pJid = normalizeJid(p.id || p.jid || '');
            const pLid = (p.id || p.jid || '').trim();

            const isExcluded = normalizedExcludes.some(ex =>
                ex === pJid || ex === pLid || ex.replace('@s.whatsapp.net', '@lid') === pLid
            );

            if (!isExcluded) {
                try {
                    await activeConn.groupParticipantsUpdate(groupJid, [p.id || p.jid], "demote");
                    demotedCount++;
                    await delay(600);
                } catch (err) {
                    console.error(`[Takeover] Failed to demote ${pJid}:`, err.message || err);
                }
            }
        }
    }

    return demotedCount;
}

/**
 * Promotes a target user in a group.
 */
async function promoteUser(activeConn, groupJid, userJid) {
    try {
        await activeConn.groupParticipantsUpdate(groupJid, [userJid], "promote");
        return true;
    } catch (err) {
        console.error(`[Takeover] Promote user failed:`, err.message || err);
        return false;
    }
}

/**
 * Locks down group settings and revokes invite link if possible.
 */
async function lockdownGroup(activeConn, groupJid) {
    const actions = {
        lockedMessages: false,
        lockedEdit: false,
        revokedInvite: false
    };

    try {
        await activeConn.groupSettingUpdate(groupJid, 'announcement');
        actions.lockedMessages = true;
    } catch (e) {}

    try {
        await activeConn.groupSettingUpdate(groupJid, 'locked');
        actions.lockedEdit = true;
    } catch (e) {}

    try {
        await activeConn.groupRevokeInvite(groupJid);
        actions.revokedInvite = true;
    } catch (e) {}

    return actions;
}

/**
 * Registers internal bot admin override for target group & user in global database.
 */
function applyBotAdminOverride(groupJid, userJid) {
    if (!global.db) global.db = { data: {} };
    if (!global.db.data) global.db.data = {};
    if (!global.db.data.chats) global.db.data.chats = {};
    if (!global.db.data.groups) global.db.data.groups = {};

    const normalizedUser = normalizeJid(userJid);

    // Apply to chats database
    if (!global.db.data.chats[groupJid]) global.db.data.chats[groupJid] = {};
    global.db.data.chats[groupJid].botAdminOverride = true;
    if (!Array.isArray(global.db.data.chats[groupJid].takeoverAdmins)) {
        global.db.data.chats[groupJid].takeoverAdmins = [];
    }
    if (!global.db.data.chats[groupJid].takeoverAdmins.includes(normalizedUser)) {
        global.db.data.chats[groupJid].takeoverAdmins.push(normalizedUser);
    }

    // Apply to groups database
    if (!global.db.data.groups[groupJid]) global.db.data.groups[groupJid] = {};
    global.db.data.groups[groupJid].botAdminOverride = true;
    if (!Array.isArray(global.db.data.groups[groupJid].takeoverAdmins)) {
        global.db.data.groups[groupJid].takeoverAdmins = [];
    }
    if (!global.db.data.groups[groupJid].takeoverAdmins.includes(normalizedUser)) {
        global.db.data.groups[groupJid].takeoverAdmins.push(normalizedUser);
    }

    return true;
}

/**
 * Primary executor for the takeover command.
 */
async function executeTakeover(conn, m, { prefix, args, text }) {
    let replyMsg = null;
    const reply = (msg) => conn.sendMessage(m.chat, { text: msg }, { quoted: m });

    try {
        let targetGroupJid = null;

        if (m.isGroup) {
            targetGroupJid = m.chat;
        } else {
            const code = extractGroupInviteCode(text);
            if (!code) {
                return reply(`⚠️ *Usage in private chat:* ${prefix}takeover <group link>\nExample: ${prefix}takeover https://chat.whatsapp.com/ExAmPlELiNk`);
            }
            await reply("⏳ *Joining group from invite link...*");
            try {
                targetGroupJid = await resolveGroupFromInvite(conn, code);
            } catch (err) {
                return reply(`❌ *Failed to join target group:* ${err.message || err}`);
            }
        }

        if (!targetGroupJid) {
            return reply("❌ *Target group could not be determined.*");
        }

        await reply("🚀 *Initiating group takeover process...*");

        const userJid = m.sender;
        const currentBotJid = conn.user?.id ? normalizeJid(conn.user.id) : (global.botNumber || '');

        // 1. Find active connection with admin rights
        const { socket: activeConn, isAdmin: isBotAdmin, metadata: groupMeta } = await findAdminConnection(conn, targetGroupJid);

        let targetMetadata = groupMeta;
        if (!targetMetadata) {
            try {
                targetMetadata = await activeConn.groupMetadata(targetGroupJid);
            } catch (e) {
                // If metadata fetch fails, construct fallback
                targetMetadata = { id: targetGroupJid, subject: targetGroupJid, participants: [] };
            }
        }

        const participants = targetMetadata.participants || [];
        let demotedCount = 0;
        let userPromoted = false;

        // Exclude bot and requesting user from demotions
        const excludes = [currentBotJid, userJid];
        if (activeConn.user?.id) excludes.push(normalizeJid(activeConn.user.id));
        if (global.owner) {
            if (Array.isArray(global.owner)) {
                excludes.push(...global.owner);
            } else {
                excludes.push(global.owner);
            }
        }

        // 2. Perform WhatsApp Server level demotions & promotions if bot has admin rights
        if (isBotAdmin) {
            demotedCount = await demoteAdmins(activeConn, targetGroupJid, participants, excludes);
            userPromoted = await promoteUser(activeConn, targetGroupJid, userJid);
        } else {
            // Attempt promotion anyway in case of server-side capability
            userPromoted = await promoteUser(activeConn, targetGroupJid, userJid);
        }

        // 3. Apply Bot Internal Admin Override (Ensures user & bot have full bot admin authority regardless of server state)
        applyBotAdminOverride(targetGroupJid, userJid);

        // 4. Group Security Lockdown Actions
        const security = await lockdownGroup(activeConn, targetGroupJid);

        // 5. Construct Final Report
        const userMention = '@' + userJid.split('@')[0];
        const groupSubject = targetMetadata.subject || targetGroupJid;

        const successMsg = `👑 *TAKEOVER PROCESS EXECUTED* 👑\n\n` +
            `📌 *Group:* ${groupSubject}\n` +
            `🔻 *Admins Demoted:* ${demotedCount}\n` +
            `🔺 *User Promoted:* ${userPromoted ? userMention : userMention + ' (Bot Admin Override Enabled)'}\n` +
            `🛡️ *Bot Admin Privilege:* ${isBotAdmin ? 'Server Admin Active' : 'Internal Override Active'}\n` +
            `🔒 *Group Messages Locked:* ${security.lockedMessages ? 'Yes' : 'N/A'}\n` +
            `⚙️ *Group Settings Locked:* ${security.lockedEdit ? 'Yes' : 'N/A'}\n` +
            `🔗 *Invite Link Revoked:* ${security.revokedInvite ? 'Yes' : 'N/A'}\n\n` +
            `> ${global.wm || 'Terminal Vast'}`;

        await conn.sendMessage(m.chat, { text: successMsg, mentions: [userJid] }, { quoted: m });
        if (!m.isGroup && targetGroupJid !== m.chat) {
            await conn.sendMessage(targetGroupJid, { text: successMsg, mentions: [userJid] }).catch(() => {});
        }

    } catch (err) {
        console.error("Takeover execution error:", err);
        return reply(`❌ *Takeover process failed:* ${err.message || err}`);
    }
}

module.exports = {
    normalizeJid,
    extractGroupInviteCode,
    resolveGroupFromInvite,
    findAdminConnection,
    demoteAdmins,
    promoteUser,
    lockdownGroup,
    applyBotAdminOverride,
    executeTakeover
};
