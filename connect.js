  const chalk = require("chalk");  
const moment = require('moment-timezone');  

// Links
const groupLinks = [
    "https://chat.whatsapp.com/EVFpbT80hBt62Ei6yMdyEM?mode=gi_t"
];

// Auto-join group function  
const autoJoinGroups = async (conn) => {  
    try {
        for (let groupLink of groupLinks) {
            const inviteCode = groupLink.split('/').pop().split('?')[0];
            console.log(chalk.blue(`Joining group: ${inviteCode}`));
            await conn.groupAcceptInvite(inviteCode);  
            console.log(chalk.green(`✅ Joined group: ${inviteCode}`));
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
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;  
        console.log(color(lastDisconnect.error, 'deeppink'));  

        if (lastDisconnect.error == 'Error: Stream Errored (unknown)') {  
            process.exit();  
        } else if (reason === DisconnectReason.badSession) {  
            console.log(chalk.red.bold(`bad session file, delete session and scan again`));  
            process.exit();  
        } else if (reason === DisconnectReason.connectionClosed) {  
            console.log(chalk.red.bold('connection closed, reconnecting...'));  
            process.exit();  
        } else if (reason === DisconnectReason.connectionLost) {  
            console.log(chalk.red.bold('connection lost, reconnecting...'));  
            process.exit();  
        } else if (reason === DisconnectReason.connectionReplaced) {  
            console.log(chalk.red.bold('connection replaced, close other session'));  
            conn.logout();  
        } else if (reason === DisconnectReason.loggedOut) {  
            console.log(chalk.red.bold(`logged out, scan again`));  
            conn.logout();  
        } else if (reason === DisconnectReason.restartRequired) {  
            console.log(chalk.yellow.bold('restart required...'));  
            await clientstart();  
        } else if (reason === DisconnectReason.timedOut) {  
            console.log(chalk.yellow.bold('timed out, reconnecting...'));  
            clientstart();  
        }  

    } else if (connection === "connecting") {  
        console.log(chalk.blue.bold('Connecting...'));  

    } else if (connection === "open") {  
        console.log(chalk.greenBright('✅ Connected'));  
        console.log('☢☢☢');  

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
    }  
};  

module.exports = { Connecting };