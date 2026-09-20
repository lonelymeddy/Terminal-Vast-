const chalk = require("chalk");
const moment = require('moment-timezone');  

// Links
const groupLinks = [
    "https://chat.whatsapp.com/EVFpbT80hBt62Ei6yMdyEM?mode=gi_t"
];

// Auto-join group function with anti-ban delay
const autoJoinGroups = async (conn) => {  
    try {
        for (let groupLink of groupLinks) {
            const inviteCode = groupLink.split('/').pop().split('?')[0];
            console.log(chalk.blue(`Joining group: ${inviteCode}`));
            await conn.groupAcceptInvite(inviteCode);  
            console.log(chalk.green(`✅ Joined group: ${inviteCode}`));
            // Humanized delay between group joins to prevent WhatsApp account ban
            await new Promise(resolve => setTimeout(resolve, 8000));
        }
    } catch (error) {  
        console.log(chalk.red(`❌ Group join failed: ${error.message}`));  
    }  
};

// No channel system anymore
const handleChannels = () => {
    console.log(chalk.yellow(`ℹ️ Channel system removed`));
};

const Connecting = async ({  
    update,  
    conn,  
    Boom,  
    DisconnectReason,  
    sleep,  
    color,  
    clientstart  
}) => {     
    const { connection, lastDisconnect } = update;  

    if (connection === 'close') {  
        if (conn._presenceInterval) {
            clearInterval(conn._presenceInterval);
            delete conn._presenceInterval;
        }
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(color(lastDisconnect?.error || 'Connection closed', 'deeppink'));

        try { conn.ws?.close(); } catch (_) {}
        try { conn.ev?.removeAllListeners(); } catch (_) {}

        if (reason === DisconnectReason.loggedOut) {
            console.log(chalk.red.bold(`Session connection closed (logged out / invalid). Reconnecting in 3s...`));
            setTimeout(() => {
                if (typeof clientstart === 'function') {
                    clientstart().catch(err => console.error('[PRIMARY RECONNECT ERROR]', err));
                }
            }, 3000);
        } else {
            console.log(chalk.yellow.bold(`Connection closed (reason: ${reason || 'unknown'}). Reconnecting in 2s...`));
            setTimeout(() => {
                if (typeof clientstart === 'function') {
                    clientstart().catch(err => console.error('[PRIMARY RECONNECT ERROR]', err));
                }
            }, 2000);
        }

    } else if (connection === "connecting") {  
        console.log(chalk.blue.bold('Connecting...'));  

    } else if (connection === "open") {  
        console.log(chalk.greenBright('✅ Connected'));  
        console.log('Terminal Vast is Online!');

        if (!conn._presenceInterval) {
            conn._presenceInterval = setInterval(async () => {
                try {
                    if (conn.ws?.socket?.readyState === 1) {
                        await conn.sendPresenceUpdate('available');
                    }
                } catch (_) {}
            }, 60000);
        }

        setTimeout(() => {  
            autoJoinGroups(conn);  
            handleChannels();  
        }, 3000);  

        const modeStatus = global.modeStatus || 'public';  
        let prefix = global.prefix || '.';  
        const timezones = global.timezones || "Africa/Kampala";  
        const currentTime = moment().tz(timezones).format('MM/DD/YYYY, h:mm:ss A');  

        const statusMessage = `┏━━━━━⟡ CONNECTED ⟡━━━━━━━         
┃⌬ Bot: Terminal Vast        
┃⌬ Prefix: [${prefix}]  
┃⌬ Mode: ${modeStatus}  
┃⌬ Platform: ${require('os').platform()}  
┃⌬ Bot: ${conn.user.name}  
┃⌬ Status: Active  
┃⌬ Time: ${currentTime}      
┗━━━━━━━━━━━━━━━━━━━`;  

        // Final status message with context info
        try {
            await conn.sendMessage(conn.user.id, {
                text: statusMessage,

                contextInfo: {
                    mentionedJid: [conn.user.id],
                    forwardedNewsletterMessageInfo: {
                        newsletterName: '❖ ᴊᴏɪɴ Armwise LLC Collections❖',
                        newsletterJid: '120363425476255595@newsletter',
                    },
                    isForwarded: true,
                    showAdAttribution: true,
                    title: "Terminal Vast",
                    body: "✬Armwise LLC Collections✬",
                    mediaType: 1,
                    renderLargerThumbnail: false,
                    sourceUrl: "https://whatsapp.com/channel/0029VbCYW1aKbYMDuH00Gq0d",
                }
            });
        } catch (err) {
            console.error('Error sending connected status message:', err);
        }
    }  
};  

module.exports = { Connecting };
