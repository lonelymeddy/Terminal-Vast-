const os = require('os');
const fs = require('fs');
const path = require('path');
const more = String.fromCharCode(8206);
const readmore = more.repeat(4001);

const { getSetting } = require('../../start/Core/settingManager');
const menuConfigPath = path.join(__dirname, '../temp/menu_config.json');

const formatMemory = (memory) => {
    return memory < 1024 * 1024 * 1024
        ? Math.round(memory / 1024 / 1024) + ' MB'
        : Math.round(memory / 1024 / 1024 / 1024) + ' GB';
};

const progressBar = (used, total, size = 10) => {
    let percentage = Math.round((used / total) * size);
    let bar = '█'.repeat(percentage) + '░'.repeat(size - percentage);
    return `[${bar}] ${Math.round((used / total) * 100)}%`;
};

const defaultPreset = "preset1";
const defaultMenuStyle = "default";

const menuPresets = {
    preset1: [
        'header',
        'pairingSite',
        'bug',
        'cmdTool',
        'features',
        'ai',
        'audio',
        'convert',
        'download',
        'ephoto',
        'fun',
        'group',
        'helpers',
        'image',
        'other',
        'owner',
        'reaction',
        'religion',
        'search'
    ]
};

function loadMenuConfig() {
    return { preset: defaultPreset, style: defaultMenuStyle };
}

function resetMenu() {}

function showCurrentMenu() {}

async function generateMenu(conn, m, prefix, global) {
    const botNumber = await conn.decodeJid(conn.user.id);

    const currentOrder = menuPresets.preset1;

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const systemUsedMemory = totalMemory - freeMemory;

    const menuSections = {

        header: {
            title: '𖠌 *Armwise LLC* ',
            content: [
                `𖠌 *ᴀɢᴇɴᴛ*: ${getSetting(botNumber, 'ownername', 'Not set')}`,
                `𖠌 *BOTNAME*: ${getSetting(botNumber, 'botname', 'Terminal')}`,
                `𖠌 *MODE*: ${conn.public ? 'public' : 'private'}`,
                `𖠌 *PREFIX*: [ ${prefix} ]`,
                `𖠌 *VERSION*: ${global.versions}`,
                `𖠌 *HOST*: ${process.platform === 'android' ? 'Android'  
                    : process.platform === 'win32' ? 'Windows'  
                    : process.platform === 'darwin' ? 'Mac'  
                    : process.platform === 'linux'  
                        ? (process.env.REPL_ID ? 'Replit'  
                        : process.env.RAILWAY_ENVIRONMENT ? 'Railway'  
                        : process.env.RENDER ? 'Render'  
                        : process.env.HEROKU ? 'Heroku'  
                        : 'Linux')  
                    : 'Unknown'}`,
                `𖠌 *COMMANDS*: 433`,
                `𖠌 *DEV*: *Lonely Meddy* `,
                `𖠌 *CHIP*: ${progressBar(systemUsedMemory, totalMemory)}\n`
            ],
        },

        pairingSite: {
            title: ' *PAIRING SITE* ',
            commands: [
                'https://terminal-vast-platform.onrender.com/'
            ],
        },
        
        bug: {
            title: ' *BUG MENU* ',
            commands: [
                'invis', 'kill-android', 'kill-iphone', 'hijack-gc', 'freeze-gc',
                'enforce-pain', 'enforce-bug', 'ripp-title',
                'crash-gc', 'wipe-gc', 'nuke-gc', 'break-gc', 'overload-gc',
                'lag-gc', 'spam-gc', 'flood-gc', 'storm-gc', 'lock-gc',
                'ghost-gc', 'mute-gc', 'silence-gc', 'corrupt-gc', 'chaos-gc'
            ],
        },

        ai: { title: ' *AI MENU* ', commands: ['generate', 'ai', 'copilot', 'metaai', 'deepseek', 'venice', 'flux', 'dalle', 'mistral', 'summarize', 'claude', 'gpt4nano', 'bard', 'perplexity', 'meddyai', 'blackbox', 'gpt'] },

        audio: { title: ' *AUDIO MENU* ', commands: ['bass', 'treble', 'blown', 'robot', 'reverse', 'instrumental', 'vocalremove', 'karaoke', 'volaudio', 'fast', 'slow'] },

        cmdTool: { title: ' *SYSTEM MENU* ', commands: ['ping', 'pair', 'uptime', 'bothosting', 'repo', 'botstatus', 'botinfo', 'sc', 'serverinfo', 'alive'] },

        convert: { title: ' *CONVERT MENU* ', commands: ['toaudio', 'toimage', 'url', 'tovideo', 'topdf', 'sticker'] },

        download: { title: ' *DOWNLOAD MENU* ', commands: ['play', 'play2', 'song', 'song2', 'music', 'ytplay', 'gitclone', 'ringtone', 'download', 'pinterest', 'mediafire', 'itunes', 'ytmp4', 'ytstalk', 'apk', 'gdrive', 'playdoc', 'tiktok', 'tiktok2', 'instagram', 'video', 'tiktokaudio', 'savestatus', 'facebook'] },

        ephoto: { title: ' *LOGO MENU* ', commands: ['blackpinklogo', 'blackpinkstyle', 'glossysilver', 'glitchtext', 'arting', 'advancedglow', 'cartoonstyle', 'deadpool', 'deletingtext', 'luxurygold', '1917style', 'pixelglitch', 'multicoloredneon', 'effectclouds', 'flagtext', 'freecreate', 'galaxystyle', 'papercut', 'holigram', 'royal', 'bear', 'textonwetglass', 'galaxywallpaper', 'glowingtext', 'makingneon', 'matrix', 'royaltext', 'sand', 'summerbeach', 'topography', 'typography', 'flux', 'dragonball'] },

        features: { title: ' *CONTROL MENU* ', commands: ['antidelete', 'anticall', 'autorecording', 'autotyping', 'alwaysonline', 'welcome', 'chatbot', 'autoread', 'adminevent', 'autoviewstatus', 'autoreactstatus', 'antiedit'] },

        fun: { title: ' *FUN MENU* ', commands: ['dare', 'Quotes', 'truth', 'fact', 'truthdetecter', 'valentines', 'advice', 'motivate', 'pickupline', '8balls', 'mee', 'trivia', 'lovetest', 'character', 'compatibility', 'compliment', 'jokes'] },

        group: { title: ' *GROUP MENU* ', commands: ['hidetag', 'kick', 'resetlink', 'linkgc', 'checkchan', 'antilink', 'antitag', 'antitagadmin', 'listonline', 'add', 'listactive', 'listinactive', 'close', 'open', 'kickinactive', 'cancelkick', 'kickall', 'closetime', 'disp24hours', 'disp90days', 'dispoff', 'setgrouppp', 'opentime', 'poll', 'totalmembers', 'mediatag', 'getgrouppp', 'tagall', 'tagall2', 'groupinfo', 'userjid', 'unlockgcsettings', 'lockgcsettings', 'tagadmin', 'setgroupname', 'delgrouppp', 'invite', 'editinfo', 'approve', 'disapproveall', 'listrequest', 'promote', 'demote', 'setdesc', 'vcf'] },

        helpers: { title: ' *HELP MENU* ', commands: ['dev'] },

        image: { title: ' *IMAGE MENU* ', commands: ['wallapaper', 'balogo', 'tattoo', 'remini'] },

        other: { title: ' *UTILITY MENU* ', commands: ['time', 'calculate', 'owner', 'fliptext', 'translate', 'ss2', 'sswebpc', 'farm', 'say', 'getdevice', 'ss', 'gpass', 'userinfo', 'npm', 'take', 'emoji', 'telesticker', 'checkapi', 'filtervcf', 'qrcode', 'smartphone', 'removebg', 'obfuscate', 'obfuscate2', 'getabout', 'tinylink', 'vcc', 'getbussiness', 'listpc', 'sswebpc'] },

        owner: { title: ' *OWNER MENU* ', commands: ['addowner', 'idch', 'createch', 'creategroup', 'del', 'setpp', 'delpp', 'private', 'public', 'lastseen', 'setprefix', 'togroupstatus', 'groupid', 'readreceipts', 'reportbug', 'clearchat', 'groupjids', 'broadcast', 'react', 'restart', 'currentmenu', 'addignorelist', 'delignorelist', 'deljunk', 'cleansession', 'settings', 'update', 'listblocked', 'listsudo', 'setprofilename', 'listignored', 'online', 'join', 'leave', 'setbio', 'resetsettings', 'backup', 'reqeust', 'block', 'toviewonce', 'setownername', 'setbotname', 'unblock', 'unblockall', 'gcaddprivacy', 'ppprivancy', 'vv', 'vv2', 'idch', 'getpp'] },

        reaction: { title: ' *REACT MENU* ', commands: ['kiss', 'blush', 'kick', 'slap', 'dance', 'bully', 'kill', 'hug', 'happy', 'cry', 'pat', 'poke', 'smile', 'wave', 'cuddle', 'highfive', 'lick', 'bite', 'glomp', 'bonk', 'yeet', 'smug', 'nom', 'sleepy', 'facepalm', 'wink', 'shy', 'stare', 'thinking', 'shoot', 'run', 'shrug', 'panic', 'tease', 'shiver', 'bored', 'scream', 'pout', 'handhold', 'spank', 'tickle', 'cringe', 'party', 'celebrate'] },

        religion: { title: ' *SPIRITUAL MENU* ', commands: ['Bible', 'Biblelist', 'Quran'] },

        search: { title: ' *SEARCH MENU* ', commands: ['lyrics', 'chord', 'weather', 'movie', 'define', 'gitstalk', 'playstore', 'tiktoksearch', 'ytsearch', 'shazam'] }
    };

    const formatDefaultMenu = () => {
        let menu = `*┏━━━━━━━━━━━━━━━━━━━┓*\n`;
        menu += menuSections.header.content.map(line => `┃ ${line}`).join('\n') + '\n';
        menu += `*┗━━━━━━━━━━━━━━━━━━━┛*\n\n`;

        let sectionCount = 0;
        for (const sectionKey of currentOrder) {
            if (sectionKey !== 'header' && menuSections[sectionKey]) {
                const section = menuSections[sectionKey];
                menu += `┏❒${section.title.toUpperCase()} ❒\n`;
                menu += section.commands.map(cmd => `┃✰ ${cmd}`).join('\n') + '\n';
                menu += `┗❒\n\n`;

                sectionCount++;
                if (sectionCount === 3) menu += `${readmore}\n\n`;
                if (sectionCount === 8) menu += `${readmore}\n\n`;
            }
        }

        menu += ` ©2026 Armwise LLC`;
        return menu;
    };

    return { formatMenu: formatDefaultMenu };
}

async function sendMenu(conn, m, prefix, global) {
    try {
        const { formatMenu } = await generateMenu(conn, m, prefix, global);

        await conn.sendMessage(m.chat, {
            image: { url: 'https://files.catbox.moe/sn73hm.jpg' },
            caption: formatMenu(),
            contextInfo: {
                mentionedJid: [m.sender],
                forwardedNewsletterMessageInfo: {
                    newsletterName: '❖ ᴊᴏɪɴ Armwise LLC Collections❖',
                    newsletterJid: '120363407328182190@newsletter',
                },
                isForwarded: true,
                showAdAttribution: true,
                title: global.botname || 'Terminal Vast',
                body: '✬Armwise LLC Collections✬',
                mediaType: 3,
                renderLargerThumbnail: false,
                thumbnail: global.cina || 'https://files.catbox.moe/sn73hm.jpg',
                sourceUrl: 'https://whatsapp.com/channel/0029VbDD5xgBlHpjUBmayj30',
            },
        }, { quoted: m });

        await conn.sendMessage(m.chat, {
            audio: { url: 'https://files.catbox.moe/yf6pu3.mp3' },
            mimetype: 'audio/mpeg',
            ptt: false,
        });

        return true;
    } catch (error) {
        console.error('Error sending menu:', error);
        throw error;
    }
}

module.exports = {
    generateMenu,
    sendMenu,
    progressBar,
    resetMenu,
    showCurrentMenu,
    loadMenuConfig,
};
