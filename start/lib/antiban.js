/**
 * Anti-Spam and Anti-Ban Protection Module for Terminal Vast
 * Prevents WhatsApp account bans by enforcing humanized delays,
 * per-user rate limiting, and burst protection for message traffic.
 */

const userCommandTrackers = new Map();
const warningCooldowns = new Map();
const outgoingQueueMap = new Map();

// Configuration defaults
const DEFAULT_CONFIG = {
    maxCommandsPerWindow: 3,
    windowMs: 7000,              // 7 seconds window
    warningCooldownMs: 15000,    // Don't spam warning messages within 15s
    minMessageIntervalMs: 800,   // Min delay between outgoing messages
    humanTypingMinMs: 800,       // Min human typing delay
    humanTypingMaxMs: 2200       // Max human typing delay
};

/**
 * Helper to generate random integer between min and max inclusive
 */
function getRandomMs(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Promise-based delay helper with optional random jitter
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if incoming command from sender is spam
 * @param {string} sender - JID of sender
 * @param {boolean} isAccess - Whether sender has owner/sudo access
 * @returns {object} { isSpam: boolean, notify: boolean, waitTimeSeconds: number }
 */
function checkCommandSpam(sender, isAccess = false) {
    const now = Date.now();
    const config = DEFAULT_CONFIG;

    // Owners / Sudo users have double allowance and shorter window
    const maxAllowed = isAccess ? config.maxCommandsPerWindow * 3 : config.maxCommandsPerWindow;
    const windowMs = isAccess ? 4000 : config.windowMs;

    if (!userCommandTrackers.has(sender)) {
        userCommandTrackers.set(sender, []);
    }

    const timestamps = userCommandTrackers.get(sender);

    // Filter out timestamps outside current window
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
    validTimestamps.push(now);
    userCommandTrackers.set(sender, validTimestamps);

    if (validTimestamps.length > maxAllowed) {
        const oldestInWindow = validTimestamps[0];
        const waitTimeSeconds = Math.ceil((windowMs - (now - oldestInWindow)) / 1000);

        // Check if warning message should be sent (prevent warning spam)
        const lastWarned = warningCooldowns.get(sender) || 0;
        let notify = false;
        if (now - lastWarned > config.warningCooldownMs) {
            warningCooldowns.set(sender, now);
            notify = true;
        }

        return {
            isSpam: true,
            notify: notify,
            waitTimeSeconds: waitTimeSeconds > 0 ? waitTimeSeconds : 2
        };
    }

    return { isSpam: false, notify: false, waitTimeSeconds: 0 };
}

/**
 * Simulates human typing or recording presence before responding
 * @param {object} conn - Baileys WA connection
 * @param {string} chatJid - Remote JID
 * @param {string} mode - 'composing' or 'recording'
 * @param {number} customMs - Optional custom duration
 */
async function simulateHumanPresence(conn, chatJid, mode = 'composing', customMs = null) {
    if (!conn || !chatJid) return;
    try {
        const duration = customMs || getRandomMs(DEFAULT_CONFIG.humanTypingMinMs, DEFAULT_CONFIG.humanTypingMaxMs);
        if (typeof conn.sendPresenceUpdate === 'function') {
            await conn.sendPresenceUpdate(mode, chatJid).catch(() => {});
        }
        await delay(duration);
    } catch (_) {
        // Fallback delay
        await delay(1000);
    }
}

/**
 * Enqueue outgoing messages to prevent burst sending
 * Spaces out messages sent through the queue with a safety delay
 */
async function enqueueOutgoingMessage(conn, chatJid, sendFunction) {
    if (!outgoingQueueMap.has(chatJid)) {
        outgoingQueueMap.set(chatJid, Promise.resolve());
    }

    const currentQueue = outgoingQueueMap.get(chatJid);
    const nextTask = currentQueue.then(async () => {
        try {
            await simulateHumanPresence(conn, chatJid, 'composing', getRandomMs(400, 900));
            return await sendFunction();
        } catch (err) {
            console.error('[Anti-Ban Queue Error]:', err.message);
        } finally {
            await delay(DEFAULT_CONFIG.minMessageIntervalMs);
        }
    });

    outgoingQueueMap.set(chatJid, nextTask.catch(() => {}));
    return nextTask;
}

/**
 * Clean up stale tracker memory periodically (every 5 minutes)
 */
setInterval(() => {
    const now = Date.now();
    for (const [sender, timestamps] of userCommandTrackers.entries()) {
        const valid = timestamps.filter(ts => now - ts < 30000);
        if (valid.length === 0) {
            userCommandTrackers.delete(sender);
        } else {
            userCommandTrackers.set(sender, valid);
        }
    }
    for (const [sender, lastWarn] of warningCooldowns.entries()) {
        if (now - lastWarn > 60000) {
            warningCooldowns.delete(sender);
        }
    }
}, 5 * 60 * 1000);

module.exports = {
    checkCommandSpam,
    simulateHumanPresence,
    enqueueOutgoingMessage,
    delay,
    getRandomMs,
    DEFAULT_CONFIG
};
