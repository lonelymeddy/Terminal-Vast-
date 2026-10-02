const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const webp = require('node-webpmux');
const crypto = require('crypto');
const axios = require("axios");
const yts = require("yt-search");
const cheerio = require("cheerio");

async function fetchYtAudio(videoUrl) {
    try {
        const bk9Url = `https://api.bk9.dev/download/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const res = await axios.get(bk9Url, { timeout: 15000 });
        if (res.data?.status && res.data?.BK9?.downloadUrl) {
            return res.data.BK9.downloadUrl;
        }
    } catch (e) {}

    try {
        const workerUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`;
        const res = await axios.get(workerUrl, { timeout: 15000 });
        if (res.data?.status && res.data?.audio) {
            return res.data.audio;
        }
    } catch (e) {}

    throw new Error('No audio URL found in response');
}

async function fetchYtVideo(videoUrl) {
    try {
        const bk9Url = `https://api.bk9.dev/download/ytmp4?url=${encodeURIComponent(videoUrl)}`;
        const res = await axios.get(bk9Url, { timeout: 15000 });
        if (res.data?.status && res.data?.BK9?.downloadUrl) {
            return res.data.BK9.downloadUrl;
        }
    } catch (e) {}

    try {
        const siputzxUrl = `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(videoUrl)}`;
        const res = await axios.get(siputzxUrl, { timeout: 15000 });
        if (res.data?.status && res.data?.data?.dl) {
            return res.data.data.dl;
        }
    } catch (e) {}

    throw new Error('YouTube video download API is currently unavailable');
}

async function playCommand(conn, chatId, message, args) {
    try {
        const text = args.join(' ').trim();
        
        if (!text) return conn.sendMessage(chatId, { 
            text: '🎵 Please provide a song name or YouTube URL\nExample: .play shape of you\nExample: .play https://youtube.com/watch?v=60ItHLz5WEA' 
        }, { quoted: message });

        let videoUrl, title, thumbnail;

        if (/youtu\.?be/.test(text)) {
            videoUrl = text;
            const id = (text.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/) || [])[1];
            if (!id) return conn.sendMessage(chatId, { 
                text: '❌ Invalid YouTube link. Input a valid YouTube URL.'
            }, { quoted: message });
            
            thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
            title = "YouTube Audio";
        } else {
            await conn.sendMessage(chatId, { 
                text: `🔍 Searching for: ${text}\n⏳ Please wait...` 
            }, { quoted: message });
            
            const searchResults = await yts(text);
            if (!searchResults.videos || searchResults.videos.length === 0) {
                return await conn.sendMessage(chatId, { 
                    text: `❌ No results found for: ${text}` 
                }, { quoted: message });
            }
            
            const video = searchResults.videos[0];
            videoUrl = video.url;
            title = video.title;
            thumbnail = video.thumbnail;
        }

        await conn.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎵 *${title}*\n\n⌛ Downloading audio... Please wait...`
        }, { quoted: message });

        await conn.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const audioUrl = await fetchYtAudio(videoUrl);

        const formatMenu = `🎵 *${title}*\n\n*Choose download format:*\n\n` +
                          `1. 📄 MP3 as Document\n` +
                          `2. 🎧 MP3 as Audio (Play)\n` +
                          `3. 🎙️ MP3 as Voice Note (PTT)\n\n` +
                          `_Reply with 1, 2 or 3 to this message to download the format you prefer._`;
        
        const songmsg = await conn.sendMessage(chatId, { text: formatMenu }, { quoted: message });

        const selectionHandler = async (msgUpdate) => {
            try {
                const mp3msg = msgUpdate.messages[0];
                if (!mp3msg.message || !mp3msg.message.extendedTextMessage) return;
                if (mp3msg.key.remoteJid !== chatId) return;

                const selectedOption = mp3msg.message.extendedTextMessage.text.trim();

                if (
                    mp3msg.message.extendedTextMessage.contextInfo &&
                    mp3msg.message.extendedTextMessage.contextInfo.stanzaId === songmsg.key.id
                ) {
                    conn.ev.off('messages.upsert', selectionHandler);
                    
                    await conn.sendMessage(chatId, { react: { text: "⬇️", key: mp3msg.key } });

                    switch (selectedOption) {
                        case "1":   
                            await conn.sendMessage(chatId, { 
                                document: { url: audioUrl }, 
                                mimetype: "audio/mpeg", 
                                fileName: `${title}.mp3`.replace(/[<>:"/\\|?*]/g, '_'),
                                caption: `🎵 *${title}*\n✅ Downloaded successfully!`
                            }, { quoted: mp3msg });   
                            break;
                            
                        case "2":   
                            await conn.sendMessage(chatId, { 
                                audio: { url: audioUrl }, 
                                mimetype: "audio/mp4",
                                fileName: `${title}.mp3`.replace(/[<>:"/\\|?*]/g, '_'),
                                ptt: false,
                                contextInfo: {
                                    externalAdReply: {
                                        title: title.length > 60 ? title.substring(0, 60) + '...' : title,
                                        body: "🎵 YouTube Audio",
                                        mediaType: 2,
                                        thumbnailUrl: thumbnail,
                                        mediaUrl: videoUrl
                                    }
                                }
                            }, { quoted: mp3msg });
                            break;
                            
                        case "3":   
                            await conn.sendMessage(chatId, { 
                                audio: { url: audioUrl }, 
                                mimetype: "audio/mp4", 
                                ptt: true,
                                fileName: `${title}.mp3`.replace(/[<>:"/\\|?*]/g, '_')
                            }, { quoted: mp3msg });
                            break;

                        default:
                            await conn.sendMessage(chatId, { text: "*❌ Invalid selection! Please reply with 1, 2 or 3*" }, { quoted: mp3msg });
                    }
                    
                    await conn.sendMessage(chatId, { react: { text: '✅', key: mp3msg.key } });
                }
            } catch (error) {
                console.error('[COMMAND ERROR] play selectionHandler:', error.message || error);
                await conn.sendMessage(chatId, { text: '❌ Error sending audio. Please try again.' }, { quoted: mp3msg });
            }
        };

        conn.ev.on('messages.upsert', selectionHandler);
        setTimeout(() => conn.ev.off('messages.upsert', selectionHandler), 120000);
        
    } catch (error) {
        console.error('[COMMAND ERROR] playCommand:', error.message || error);
        await conn.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await conn.sendMessage(chatId, { text: '❌ Error fetching audio. Please try again later.' }, { quoted: message });
    }
}

async function takeCommand(conn, chatId, message, args) {
    try {
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMessage?.stickerMessage) {
            await conn.sendMessage(chatId, { text: '❌ Reply to a sticker with .take <packname>' });
            return;
        }

        const packname = args.join(' ') || 'Terminal Vast';

        try {
            const stickerBuffer = await downloadMediaMessage(
                {
                    key: message.message.extendedTextMessage.contextInfo.stanzaId,
                    message: quotedMessage,
                    messageType: 'stickerMessage'
                },
                'buffer',
                {},
                {
                    logger: console,
                    reuploadRequest: conn.updateMediaMessage
                }
            );

            if (!stickerBuffer) {
                await conn.sendMessage(chatId, { text: '❌ Failed to download sticker' });
                return;
            }

            const img = new webp.Image();
            await img.load(stickerBuffer);

            const json = {
                'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
                'sticker-pack-name': packname,
                'emojis': ['🤖']
            };

            const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
            const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
            const exif = Buffer.concat([exifAttr, jsonBuffer]);
            exif.writeUIntLE(jsonBuffer.length, 14, 4);

            img.exif = exif;
            const finalBuffer = await img.save(null);

            await conn.sendMessage(chatId, { sticker: finalBuffer }, { quoted: message });

        } catch (error) {
            console.error('[COMMAND ERROR] takeCommand sticker processing:', error.message || error);
            await conn.sendMessage(chatId, { text: '❌ Error processing sticker' });
        }

    } catch (error) {
        console.error('[COMMAND ERROR] takeCommand:', error.message || error);
        await conn.sendMessage(chatId, { text: '❌ Error processing command' });
    }
}

async function videoCommand(conn, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = text.split(' ').slice(1);
        const youtubeUrl = args.join(' ').trim();

        if (!youtubeUrl || !youtubeUrl.includes('youtu')) {
            return await conn.sendMessage(chatId, { text: '*⚠️ Please provide a valid YouTube URL!*' }, { quoted: message });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
        await conn.sendMessage(chatId, { text: '⏳ Downloading YouTube video... Please wait...' }, { quoted: message });

        let videoUrl = null;
        try {
            videoUrl = await fetchYtVideo(youtubeUrl);
        } catch (e) {}

        if (!videoUrl) {
            throw new Error('YouTube video download service is currently unavailable.');
        }

        await conn.sendMessage(chatId, {
            video: { url: videoUrl },
            caption: `✅ Successfully downloaded YouTube video!`,
            mimetype: 'video/mp4'
        }, { quoted: message });

        await conn.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('[COMMAND ERROR] videoCommand:', error.message || error);
        await conn.sendMessage(chatId, { text: '❌ Error downloading video: ' + (error.message || 'Please try again later.') }, { quoted: message });
        await conn.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

async function ytplayCommand(conn, chatId, query, message) {
    try {
        if (!query) {
            return await conn.sendMessage(chatId, {
                text: "⚠️ Please provide a YouTube link or song name.\n\nExample:\n```.ytplay another love```"
            });
        }

        let videoUrl, title, thumbnail;

        if (/youtu\.?be/.test(query)) {
            videoUrl = query;
            const id = (query.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/) || [])[1];
            if (!id) return await conn.sendMessage(chatId, { text: "❌ Invalid YouTube link." });
            thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
            title = "YouTube Audio";
        } else {
            const searchResults = await yts(query);
            if (!searchResults.videos || searchResults.videos.length === 0) {
                return await conn.sendMessage(chatId, { text: `❌ No results found for: ${query}` });
            }
            const video = searchResults.videos[0];
            videoUrl = video.url;
            title = video.title;
            thumbnail = video.thumbnail;
        }

        await conn.sendMessage(chatId, {
            image: { url: thumbnail },
            caption: `🎵 *${title}*\n\n⌛ Downloading audio... Please wait...`
        }, { quoted: message });

        await conn.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const audioUrl = await fetchYtAudio(videoUrl);

        await conn.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`.replace(/[<>:"/\\|?*]/g, '_'),
            ptt: false,
            caption: `🎧 *${title}*\n\n✅ Downloaded successfully!`
        }, { quoted: message });

        await conn.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('[COMMAND ERROR] ytplayCommand:', error.message || error);
        await conn.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await conn.sendMessage(chatId, { text: '❌ Error downloading audio. Please try again.' }, { quoted: message });
    }
}

async function InstagramCommand(conn, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = text.split(' ').slice(1);
        const instagramUrl = args.join(' ').trim();

        if (!instagramUrl || !instagramUrl.includes('instagram.com')) {
            return await conn.sendMessage(chatId, { text: '❌ Please provide a valid Instagram URL.' }, { quoted: message });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const res = await axios.get(`https://api.bk9.dev/download/instagram?url=${encodeURIComponent(instagramUrl)}`, { timeout: 15000 });
        const items = res.data?.BK9;

        if (!res.data?.status || !items || items.length === 0) {
            throw new Error('No media found for this Instagram link');
        }

        const mediaItem = items[0];
        const mediaUrl = mediaItem.url || mediaItem.downloadUrl || (typeof mediaItem === 'string' ? mediaItem : null);

        if (!mediaUrl) throw new Error('No media URL found');

        if (mediaItem.type === 'video' || (typeof mediaUrl === 'string' && mediaUrl.includes('.mp4'))) {
            await conn.sendMessage(chatId, {
                video: { url: mediaUrl },
                caption: `✅ Instagram video downloaded successfully!`
            }, { quoted: message });
        } else {
            await conn.sendMessage(chatId, {
                image: { url: mediaUrl },
                caption: `✅ Instagram photo downloaded successfully!`
            }, { quoted: message });
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('[COMMAND ERROR] InstagramCommand:', error.message || error);
        await conn.sendMessage(chatId, { text: '❌ Error downloading Instagram media. Please try again.' }, { quoted: message });
        await conn.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

async function handleMediafireDownload(conn, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = text.split(' ').slice(1);
        const mediafireUrl = args.join(' ').trim();

        if (!mediafireUrl || !mediafireUrl.includes('mediafire.com')) {
            return await conn.sendMessage(chatId, { text: '❌ Please provide a valid MediaFire URL.' }, { quoted: message });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Scrape MediaFire page directly using Cheerio
        const res = await axios.get(mediafireUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 15000
        });

        const $ = cheerio.load(res.data);
        const downloadUrl = $("#downloadButton").attr("href");
        const filename = $(".dl-btn-label").attr("title") || $(".filename").text().trim() || "mediafire_file";
        const filesize = $(".dl-info .caption span").first().text().trim() || "Unknown";
        const mimetype = downloadUrl ? (downloadUrl.endsWith('.pdf') ? 'application/pdf' : downloadUrl.endsWith('.zip') ? 'application/zip' : downloadUrl.endsWith('.mp4') ? 'video/mp4' : downloadUrl.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream') : 'application/octet-stream';

        if (!downloadUrl) {
            throw new Error('Could not find download link on MediaFire page');
        }

        const caption = `📦 *MediaFire Downloader*\n\n` +
                        `📁 *File:* ${filename}\n` +
                        `📊 *Size:* ${filesize}\n` +
                        `📥 *Download Link:*\n${downloadUrl}`;

        // Send file as document
        await conn.sendMessage(chatId, {
            document: { url: downloadUrl },
            mimetype: mimetype,
            fileName: filename,
            caption: caption
        }, { quoted: message });

        await conn.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('[COMMAND ERROR] handleMediafireDownload:', error.message || error);
        await conn.sendMessage(chatId, { text: '❌ Error processing MediaFire link: ' + (error.message || 'File not found') }, { quoted: message });
        await conn.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

async function telestickerCommand(conn, chatId, message, args) {
    try {
        const text = args.join(' ').trim();
        if (!text) {
            return await conn.sendMessage(chatId, { text: '❌ Please provide a Telegram sticker pack URL or pack name.' }, { quoted: message });
        }

        await conn.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        await conn.sendMessage(chatId, { text: '❌ Telegram sticker downloader service is currently unavailable.' }, { quoted: message });
        await conn.sendMessage(chatId, { react: { text: '❌', key: message.key } });

    } catch (error) {
        console.error('[COMMAND ERROR] telestickerCommand:', error.message || error);
        await conn.sendMessage(chatId, { text: '❌ Error processing Telegram stickers: ' + error.message }, { quoted: message });
        await conn.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

async function musicCommand(conn, chatId, message, args) {
    const text = args.join(' ').trim();
    return ytplayCommand(conn, chatId, text, message);
}

module.exports = { playCommand, InstagramCommand, handleMediafireDownload, ytplayCommand, videoCommand, takeCommand, telestickerCommand, musicCommand };
