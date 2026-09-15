const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'data', 'auth-users.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(USERS_FILE))) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
}

// In-memory brute force protection tracking
const loginAttempts = new Map(); // key: ip, value: { count, lastAttempt }
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        // Seed default admin user if file doesn't exist
        const defaultHash = bcrypt.hashSync('adminpassword', 10);
        const defaultUsers = [
            {
                id: 'user_admin_001',
                username: 'admin',
                passwordHash: defaultHash,
                role: 'admin',
                createdAt: new Date().toISOString()
            }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
        return defaultUsers;
    }
    try {
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('⚠️ Error loading auth-users.json:', err);
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
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
async function registerUser({ username, password, role = 'user' }) {
    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();

    if (!normalizedUser || normalizedUser.length < 3) {
        throw new Error('Username must be at least 3 characters long.');
    }
    if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
    }
    if (users.some(u => u.username.toLowerCase() === normalizedUser)) {
        throw new Error('Username already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        username: normalizedUser,
        passwordHash,
        role: role === 'admin' ? 'admin' : 'user',
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
}

async function authenticateUser(username, password, ip = '127.0.0.1') {
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
        throw new Error(rateCheck.message);
    }

    const users = loadUsers();
    const normalizedUser = String(username || '').trim().toLowerCase();
    const user = users.find(u => u.username.toLowerCase() === normalizedUser);

    if (!user) {
        recordFailedAttempt(ip);
        throw new Error('Invalid username or password.');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        recordFailedAttempt(ip);
        throw new Error('Invalid username or password.');
    }

    clearFailedAttempts(ip);
    const { passwordHash: _, ...safeUser } = user;
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
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
}

module.exports = {
    loadUsers,
    registerUser,
    authenticateUser,
    changePassword,
    resetPasswordInternal,
    getAllUsersSafe,
    requireAuth,
    requireAdmin
};
