async function isAdminMeddy(conn, chatId, senderId) {
    try {
        const chatOverride = global.db?.data?.chats?.[chatId];
        const groupOverride = global.db?.data?.groups?.[chatId];

        const isOverrideActive = chatOverride?.botAdminOverride || groupOverride?.botAdminOverride;
        const normalizedSender = senderId ? senderId.split(':')[0] : '';
        const isTakeoverAdmin = (chatOverride?.takeoverAdmins && chatOverride.takeoverAdmins.includes(normalizedSender)) ||
                               (groupOverride?.takeoverAdmins && groupOverride.takeoverAdmins.includes(normalizedSender));

        let groupMetadata;
        try {
            groupMetadata = await conn.groupMetadata(chatId);
        } catch (e) {
            groupMetadata = null;
        }
        
        // Get bot ID properly
        const botId = conn.user?.id ? (conn.decodeJid ? conn.decodeJid(conn.user.id) : conn.user.id.split(':')[0] + '@s.whatsapp.net') : '';

        if (!groupMetadata) {
            if (isOverrideActive) {
                return { isSenderAdmin: true, isBotAdmin: true };
            }
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        const participants = groupMetadata.participants || [];
        
        const participant = participants.find(p =>
            p.id === senderId || 
            p.id === senderId.replace('@s.whatsapp.net', '@lid') ||
            p.id === senderId.replace('@lid', '@s.whatsapp.net')
        );
        
        const bot = participants.find(p =>
            p.id === botId || 
            p.id === botId.replace('@s.whatsapp.net', '@lid')
        );
        
        let isBotAdmin = (bot && (bot.admin === 'admin' || bot.admin === 'superadmin')) || Boolean(isOverrideActive);
        let isSenderAdmin = (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) || Boolean(isTakeoverAdmin || (isOverrideActive && participant));

        // If bot not found in participants (edge case), assume it's admin if override active or default
        if (!bot) {
            return { isSenderAdmin, isBotAdmin: true };
        }

        return { isSenderAdmin, isBotAdmin };
    } catch (error) {
        console.error('Error in isAdmin:', error);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = { isAdminMeddy };
