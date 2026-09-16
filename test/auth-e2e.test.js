const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const auth = require('../auth');

const USERS_FILE = path.join(__dirname, '..', 'data', 'auth-users.json');

async function runE2ETests() {
    console.log('==================================================');
    console.log('RUNNING END-TO-END AUTHENTICATION SYSTEM TESTS');
    console.log('==================================================\n');

    // Setup Test Express Server
    const app = express();
    app.use(express.json());
    app.use(session({
        secret: 'test_session_secret_2026',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true }
    }));

    app.get('/api/auth/me', (req, res) => {
        if (req.session && req.session.user) {
            const freshUser = auth.getAllUsersSafe().find(u => u.username === req.session.user.username);
            return res.json({ authenticated: true, user: freshUser || req.session.user });
        }
        return res.json({ authenticated: false, user: null });
    });

    app.post('/api/auth/register', async (req, res) => {
        try {
            const { username, email, password } = req.body || {};
            const userCount = auth.getAllUsersSafe().length;
            const role = userCount === 0 ? 'admin' : 'user';
            const user = await auth.registerUser({ username, email, password, role });
            req.session.user = user;
            res.json({ status: 'ok', message: 'Registration successful', user });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.post('/api/auth/login', async (req, res) => {
        try {
            const { loginInput, username, email, password } = req.body || {};
            const identifier = loginInput || username || email;
            const user = await auth.authenticateUser(identifier, password, '127.0.0.1');
            req.session.user = user;
            res.json({ status: 'ok', message: 'Login successful', user });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.post('/api/auth/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) return res.status(500).json({ error: 'Could not log out.' });
            res.clearCookie('connect.sid');
            res.json({ status: 'ok', message: 'Logged out successfully' });
        });
    });

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    let cookie = '';

    try {
        // TEST 1 — CLEAN DATABASE
        fs.writeFileSync(USERS_FILE, '[]', 'utf8');
        const count1 = auth.getAllUsersSafe().length;
        console.log(`TEST 1 — CLEAN DATABASE: User accounts count = ${count1}`);
        if (count1 !== 0) throw new Error(`TEST 1 FAILED: Expected 0 users, got ${count1}`);
        console.log('✅ TEST 1 PASSED\n');

        // TEST 2 — NEW REGISTRATION
        const regRes = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Meddy', email: 'example@gmail.com', password: 'mypassword' })
        });
        const setCookieHeader = regRes.headers.get('set-cookie');
        if (setCookieHeader) cookie = setCookieHeader.split(';')[0];

        const regData = await regRes.json();
        console.log('TEST 2 — NEW REGISTRATION:', regRes.status, regData);
        if (regRes.status !== 200 || !regData.user || regData.user.username !== 'meddy') {
            throw new Error('TEST 2 FAILED: Registration did not succeed properly');
        }
        console.log('✅ TEST 2 PASSED\n');

        // TEST 3 — LOGIN
        const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginInput: 'example@gmail.com', password: 'mypassword' })
        });
        const loginData = await loginRes.json();
        console.log('TEST 3 — LOGIN:', loginRes.status, loginData);
        if (loginRes.status !== 200 || !loginData.user) {
            throw new Error('TEST 3 FAILED: Login failed for newly created credentials');
        }
        console.log('✅ TEST 3 PASSED\n');

        // TEST 4 — WRONG PASSWORD
        const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginInput: 'example@gmail.com', password: 'wrongpassword' })
        });
        const wrongPassData = await wrongPassRes.json();
        console.log('TEST 4 — WRONG PASSWORD:', wrongPassRes.status, wrongPassData);
        if (wrongPassRes.status !== 400 || wrongPassData.error !== 'Invalid username/email or password.') {
            throw new Error('TEST 4 FAILED: Login should have failed for wrong password');
        }
        console.log('✅ TEST 4 PASSED\n');

        // TEST 5 — DUPLICATE EMAIL
        const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Meddy2', email: 'EXAMPLE@GMAIL.COM', password: 'mypassword' })
        });
        const dupData = await dupRes.json();
        console.log('TEST 5 — DUPLICATE EMAIL:', dupRes.status, dupData);
        if (dupRes.status !== 400 || !dupData.error.includes('already registered')) {
            throw new Error('TEST 5 FAILED: Duplicate email was allowed or wrong error returned');
        }
        console.log('✅ TEST 5 PASSED\n');

        // TEST 6 — ADMIN EMAIL
        const adminEmailRes = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'delostuser', email: 'delostvoyage@gmail.com', password: 'mypassword123' })
        });
        const adminEmailData = await adminEmailRes.json();
        console.log('TEST 6 — ADMIN EMAIL REGISTRATION:', adminEmailRes.status, adminEmailData);
        if (adminEmailRes.status !== 200 || !adminEmailData.user) {
            throw new Error('TEST 6 FAILED: Admin email registration should be allowed when not registered');
        }
        console.log('✅ TEST 6 PASSED\n');

        // TEST 7 — REFRESH / SESSION CHECK
        const sessionRes = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { 'Cookie': cookie }
        });
        const sessionData = await sessionRes.json();
        console.log('TEST 7 — REFRESH / SESSION CHECK:', sessionData);
        if (!sessionData.authenticated || !sessionData.user) {
            throw new Error('TEST 7 FAILED: Session was not maintained');
        }
        console.log('✅ TEST 7 PASSED\n');

        // TEST 8 — LOGOUT
        const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Cookie': cookie }
        });
        const logoutData = await logoutRes.json();
        console.log('TEST 8 — LOGOUT:', logoutData);
        if (logoutRes.status !== 200) throw new Error('TEST 8 FAILED: Logout failed');
        console.log('✅ TEST 8 PASSED\n');

        // TEST 9 — LOGIN AGAIN
        const reLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginInput: 'delostuser', password: 'mypassword123' })
        });
        const reLoginData = await reLoginRes.json();
        console.log('TEST 9 — RE-LOGIN AGAIN:', reLoginData);
        if (reLoginRes.status !== 200 || !reLoginData.user) {
            throw new Error('TEST 9 FAILED: Re-login failed');
        }
        console.log('✅ TEST 9 PASSED\n');

        // TEST 10 — SERVER RESTART / PERSISTENCE
        // Simulate module re-read from disk
        delete require.cache[require.resolve('../auth')];
        const authFresh = require('../auth');
        const dbUsers = authFresh.getAllUsersSafe();
        console.log(`TEST 10 — PERSISTENCE: Total users loaded from disk after restart = ${dbUsers.length}`);
        if (dbUsers.length !== 2) {
            throw new Error(`TEST 10 FAILED: Expected 2 persistent accounts, found ${dbUsers.length}`);
        }
        console.log('✅ TEST 10 PASSED\n');

        // TEST 11 — SECOND ACCOUNT
        const secondRes = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'userthree', email: 'userthree@example.com', password: 'mypassword123' })
        });
        const secondData = await secondRes.json();
        console.log('TEST 11 — SECOND ACCOUNT:', secondData);
        if (secondRes.status !== 200 || authFresh.getAllUsersSafe().length !== 3) {
            throw new Error('TEST 11 FAILED: Second account creation failed');
        }
        console.log('✅ TEST 11 PASSED\n');

        console.log('==================================================');
        console.log('ALL 11 END-TO-END TESTS PASSED SUCCESSFULLY!');
        console.log('==================================================');

    } catch (e) {
        console.error('❌ TEST RUN FAILED:', e);
        process.exitCode = 1;
    } finally {
        server.close();
        fs.writeFileSync(USERS_FILE, '[]', 'utf8');
        console.log('Account storage reset to clean state (0 accounts).');
    }
}

runE2ETests();
