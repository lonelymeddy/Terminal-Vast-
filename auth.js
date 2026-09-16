const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'data', 'auth-users.json');
const ADMIN_EMAILS = ['delostvoyage@gmail.com', 'meddymususwa126@gmail.com'];

// Ensure data directory exists
if (!fs.existsSync(path.dirname(USERS_FILE))) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
}

function isSpecialAdmin(email) {
    if (!email) return false;
    return ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}

// In-memory brute force protection tracking
const loginAttempts = new Map(); // key: ip, value: { count, lastAttempt }
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
        return [];
    }
    try {
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        const users = JSON.parse(raw);
        let modified = false;
        users.forEach(u => {
            if (u.balance === undefined) {
                u.balance = 0.00;
                modified = true;
            }
            if (!u.email) {
                u.email = u.username + '@terminalvast.bot';
                modified = true;
            }
            const shouldBeAdmin = isSpecialAdmin(u.email);
            if (shouldBeAdmin && u.role !== 'admin') {
                u.role = 'admin';
                modified = true;
            } else if (!shouldBeAdmin && u.role === 'admin') {
                u.role = 'user';
                modified = true;
            }
            if (!u.accountStatus) {
                u.accountStatus = 'active';
                modified = true;
            }
            if (u.warningMessage === undefined) {
                u.warningMessage = '';
                modified = true;
            }
            if (!Array.isArray(u.adminMessages)) {
                u.adminMessages = [];
                modified = true;
            }
        });
        if (modified) {
            saveUsers(users);
        }
        return users;
    } catch (err) {
        console.error('⚠️ Error loading auth-users.json:', err);
        return [];
    }
}

function saveUsers(users) {
    const tempFile = `${USERS_FILE}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
        fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf8');
        fs.renameSync(tempFile, USERS_FILE);
    } catch (err) {
        if (fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile); } catch (_) {}
        }
        console.error('⚠️ Atomic write failed for auth-users.json, fallback to direct write:', err);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    }
}

function checkRateLimit(ip) {
    const record = loginAttempts.get(ip);
    if (!record) return { allowed: true };
    const now = Date.now();
    if (now - record.lastAttempt > LOCK_TIME_MS) {
        loginAttempts.delete(ip);
        return { allowed: true };
    }
    if (record.count >= MAX_ATTEMPTS) {
        const remainingMinutes = Math.ceil((LOCK_TIME_MS - (now - record.lastAttempt)) / 60000);
        return { allowed: false, message: `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).` };
    }
    return { allowed: true };
}

function recordFailedAttempt(ip) {
    const record = loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
    record.count += 1;
    record.lastAttempt = Date.now();
    loginAttempts.set(ip, record);
}

function clearFailedAttempts(ip) {
    loginAttempts.delete(ip);
}

// Helper functions for auth management
async function registerUser({ username, email, password }) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedUser || normalizedUser.length < 3) {
        throw new Error('Username must be at least 3 characters long.');
    }
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new Error('A valid email address is required.');
    }
    if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
    }
    if (users.some(u => (u.username || '').toLowerCase() === normalizedUser)) {
        throw new Error('Username already exists.');
    }
    if (users.some(u => (u.email || '').toLowerCase() === normalizedEmail)) {
        throw new Error('Email address is already registered.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const isAdminEmail = isSpecialAdmin(normalizedEmail);
    const newUser = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        username: normalizedUser,
        email: normalizedEmail,
        passwordHash,
        role: isAdminEmail ? 'admin' : 'user',
        balance: 0.00,
        accountStatus: 'active',
        warningMessage: '',
        adminMessages: [],
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
}

async function authenticateUser(loginInput, password, ip = '127.0.0.1') {
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
        throw new Error(rateCheck.message);
    }

    const users = loadUsers();
    const query = String(loginInput || '').trim().toLowerCase();
    const user = users.find(u => (u.username || '').toLowerCase() === query || (u.email || '').toLowerCase() === query);

    if (!user) {
        recordFailedAttempt(ip);
        throw new Error('Invalid username/email or password.');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        recordFailedAttempt(ip);
        throw new Error('Invalid username/email or password.');
    }

    clearFailedAttempts(ip);
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
}

async function updateProfile(username, { email, bio }) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUser);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }

    if (email) {
        const normalizedEmail = String(email).trim().toLowerCase();
        if (!normalizedEmail.includes('@')) throw new Error('Invalid email address.');
        const existing = users.find((u, idx) => idx !== userIndex && u.email.toLowerCase() === normalizedEmail);
        if (existing) throw new Error('Email is already used by another account.');
        users[userIndex].email = normalizedEmail;
        users[userIndex].role = isSpecialAdmin(normalizedEmail) ? 'admin' : 'user';
    }

    if (bio !== undefined) {
        users[userIndex].bio = String(bio).trim();
    }

    saveUsers(users);
    const { passwordHash: _, ...safeUser } = users[userIndex];
    return safeUser;
}

async function updateAvatar(username, avatarData) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUser);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }

    users[userIndex].avatar = avatarData;
    saveUsers(users);
    const { passwordHash: _, ...safeUser } = users[userIndex];
    return safeUser;
}

async function changePassword(username, oldPassword, newPassword) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUser);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }

    const user = users[userIndex];
    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
        throw new Error('Incorrect current password.');
    }

    if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long.');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    users[userIndex] = user;
    saveUsers(users);

    return true;
}

async function resetPasswordInternal(username, newPassword) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUser);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }

    if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long.');
    }

    users[userIndex].passwordHash = await bcrypt.hash(newPassword, 10);
    saveUsers(users);

    return true;
}

function topUpBalance(username, amount) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUser);

    if (userIndex === -1) {
        throw new Error('User not found.');
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error('Top up amount must be a positive number.');
    }

    users[userIndex].balance = (users[userIndex].balance || 0) + numericAmount;
    saveUsers(users);

    const { passwordHash: _, ...safeUser } = users[userIndex];
    return safeUser;
}

function getUserBalance(username) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const user = users.find(u => u.username.toLowerCase() === normalizedUser);
    if (!user) return 0.00;
    return user.balance || 0.00;
}

function getAllUsersSafe() {
    const users = loadUsers();
    return users.map(({ passwordHash, ...safeUser }) => safeUser);
}

// Middleware functions
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && isSpecialAdmin(req.session.user.email)) {
        return next();
    }
    return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
}

function adminUpdateUserStatus(username, { status, warningMessage }) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUser);
    if (userIndex === -1) throw new Error('User not found.');

    if (status) {
        if (!['active', 'warned', 'restricted', 'banned'].includes(status)) {
            throw new Error('Invalid account status.');
        }
        users[userIndex].accountStatus = status;
    }
    if (warningMessage !== undefined) {
        users[userIndex].warningMessage = String(warningMessage || '').trim();
    }
    saveUsers(users);
    const { passwordHash: _, ...safeUser } = users[userIndex];
    return safeUser;
}

function adminUpdateUserRole(username, role) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUser);
    if (userIndex === -1) throw new Error('User not found.');

    if (!['user', 'admin'].includes(role)) {
        throw new Error('Invalid role.');
    }
    users[userIndex].role = isSpecialAdmin(users[userIndex].email) ? 'admin' : 'user';
    saveUsers(users);
    const { passwordHash: _, ...safeUser } = users[userIndex];
    return safeUser;
}

function adminSendUserMessage(username, messageText, senderUsername = 'Admin') {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();

    if (normalizedUser === 'all') {
        const timestamp = new Date().toISOString();
        const msgObj = { id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), text: messageText, sender: senderUsername, createdAt: timestamp, read: false };
        users.forEach(u => {
            if (!Array.isArray(u.adminMessages)) u.adminMessages = [];
            u.adminMessages.unshift(msgObj);
        });
        saveUsers(users);
        return { count: users.length };
    } else {
        const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUser);
        if (userIndex === -1) throw new Error('Target user not found.');
        if (!Array.isArray(users[userIndex].adminMessages)) users[userIndex].adminMessages = [];
        const msgObj = { id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), text: messageText, sender: senderUsername, createdAt: new Date().toISOString(), read: false };
        users[userIndex].adminMessages.unshift(msgObj);
        saveUsers(users);
        const { passwordHash: _, ...safeUser } = users[userIndex];
        return safeUser;
    }
}

module.exports = {
    isSpecialAdmin,
    loadUsers,
    saveUsers,
    registerUser,
    authenticateUser,
    changePassword,
    resetPasswordInternal,
    topUpBalance,
    getUserBalance,
    getAllUsersSafe,
    updateProfile,
    updateAvatar,
    adminUpdateUserStatus,
    adminUpdateUserRole,
    adminSendUserMessage,
    requireAuth,
    requireAdmin
};
