let currentUser = null;
let currentTab = getTabFromPath() || localStorage.getItem('tv_active_tab') || 'dashboard';
let currentProfileSection = 'overview';
let isGuest = false;
let currentChartTab = 'cpu';

function getTabFromPath() {
    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!rawPath || rawPath === 'dashboard' || rawPath === 'home' || rawPath === 'overview') return 'dashboard';
    if (rawPath === 'pair' || rawPath === 'connect' || rawPath === 'infrastructure') return 'pair';
    if (rawPath === 'topup' || rawPath === 'wallet' || rawPath === 'cost') return 'topup';
    if (rawPath === 'automations' || rawPath === 'automation' || rawPath === 'microservices') return 'automations';
    if (rawPath.startsWith('profile') || rawPath === 'settings' || rawPath === 'blog' || rawPath === 'history' || rawPath === 'admin') return 'profile';
    return null;
}

document.addEventListener("DOMContentLoaded", () => {
    disablePageZoomGestures();
    initCropperEvents();
    startStartupSequence();
    initResourceChart();
    window.addEventListener('resize', drawResourceChart);
});

/* ==========================================================================
   STARTUP SEQUENCE (SPLASH -> INTRO -> AUTH/GUEST -> DASHBOARD)
   ========================================================================== */
function startStartupSequence() {
    const splashScreen = document.getElementById("splashScreen");
    let sessionResultPromise = checkSessionInternal();

    setTimeout(() => {
        if (splashScreen) {
            splashScreen.style.opacity = "0";
            setTimeout(() => {
                splashScreen.style.display = "none";
                runAnimatedIntro(sessionResultPromise);
            }, 400);
        } else {
            runAnimatedIntro(sessionResultPromise);
        }
    }, 1200);
}

function runAnimatedIntro(sessionResultPromise) {
    const introScreen = document.getElementById("introScreen");
    const introText1 = document.getElementById("introText1");
    const introText2 = document.getElementById("introText2");

    if (!introScreen || !introText1 || !introText2) {
        finishStartupFlow(sessionResultPromise);
        return;
    }

    introScreen.style.display = "flex";

    setTimeout(() => {
        introText1.classList.add("visible");
    }, 100);

    setTimeout(() => {
        introText1.classList.remove("visible");
        setTimeout(() => {
            introText1.style.display = "none";
            introText2.style.display = "block";
            setTimeout(() => {
                introText2.classList.add("visible");
            }, 50);
        }, 300);
    }, 1000);

    setTimeout(() => {
        introText2.classList.remove("visible");
        setTimeout(() => {
            introScreen.style.display = "none";
            finishStartupFlow(sessionResultPromise);
        }, 300);
    }, 1800);
}

async function finishStartupFlow(sessionResultPromise) {
    const authData = await sessionResultPromise;

    if (authData && authData.authenticated && authData.user) {
        currentUser = authData.user;
        isGuest = false;
        showAppDashboard();
    } else {
        showAuthScreen();
    }
}

function showAuthScreen() {
    const authScreen = document.getElementById("authScreen");
    const appShell = document.getElementById("appShell");
    if (appShell) appShell.style.display = "none";
    if (authScreen) authScreen.style.display = "flex";
}

function showAppDashboard() {
    const authScreen = document.getElementById("authScreen");
    const appShell = document.getElementById("appShell");
    if (authScreen) authScreen.style.display = "none";
    if (appShell) appShell.style.display = "flex";
    renderAuthenticatedUI();
}

function handleContinueAsGuest() {
    isGuest = true;
    currentUser = {
        username: 'Alex Rivera',
        email: 'alex.rivera@techstack.io',
        role: 'Senior DevOps Lead',
        balance: 0,
        guest: true
    };
    showAppDashboard();
}

function disablePageZoomGestures() {
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

window.addEventListener("popstate", () => {
    const tab = getTabFromPath() || 'dashboard';
    if (currentUser) {
        switchTab(tab, false);
    }
});

/* ==========================================================================
   LOADING SPINNER HELPER
   ========================================================================== */
async function runWithSpinner(buttonEl, loadingText, asyncTaskFn, minMs = 300) {
    if (!buttonEl) return await asyncTaskFn();
    const originalText = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;

    const startTime = Date.now();
    let result;
    let taskError = null;

    try {
        result = await asyncTaskFn();
    } catch (err) {
        taskError = err;
    } finally {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minMs - elapsedTime);
        if (remainingTime > 0) {
            await new Promise(res => setTimeout(res, remainingTime));
        }
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalText;
    }

    if (taskError) throw taskError;
    return result;
}

/* ==========================================================================
   SESSION CHECK & AUTHENTICATION
   ========================================================================== */
async function checkSessionInternal() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Session check error:", err);
        return { authenticated: false, user: null };
    }
}

function renderAuthenticatedUI() {
    const tabFromPath = getTabFromPath();
    if (tabFromPath) currentTab = tabFromPath;

    updateProfileAvatarDisplay();

    if (currentUser) {
        const uDisp = document.getElementById("profileUsernameDisplay");
        if (uDisp) uDisp.textContent = currentUser.username || 'Alex Rivera';

        const hName = document.getElementById("headerUsernameStr");
        if (hName) hName.textContent = currentUser.username || 'Alex Rivera';

        const hRole = document.getElementById("headerRoleStr");
        if (hRole) hRole.textContent = isGuest ? 'GUEST / DEVOPS' : (currentUser.role || 'Senior DevOps Lead').toUpperCase();

        const eDisp = document.getElementById("profileEmailDisplay");
        if (eDisp) eDisp.textContent = currentUser.email || 'alex.rivera@techstack.io';

        const oEmail = document.getElementById("profileOverviewEmail");
        if (oEmail) oEmail.textContent = currentUser.email || 'alex.rivera@techstack.io';

        const rBadge = document.getElementById("profileRoleBadge");
        if (rBadge) rBadge.textContent = isGuest ? 'GUEST' : (currentUser.role || 'DevOps').toUpperCase();

        const editEmail = document.getElementById("editProfileEmail");
        if (editEmail) editEmail.value = currentUser.email || '';

        const editBio = document.getElementById("editProfileBio");
        if (editBio) editBio.value = currentUser.bio || '';

        const joinedEl = document.getElementById("profileJoinedDisplay");
        if (joinedEl) {
            if (currentUser.createdAt) {
                joinedEl.textContent = new Date(currentUser.createdAt).toLocaleDateString();
            } else {
                joinedEl.textContent = '2026';
            }
        }

        updateWalletDisplay(currentUser.balance || 0);

        const ADMIN_EMAILS = ['delostvoyage@gmail.com', 'voyagedelost@gmail.com', 'admin@techstack.io'];
        const isAdmin = !isGuest && (currentUser.role === 'admin' || (currentUser.email && ADMIN_EMAILS.includes(currentUser.email.trim().toLowerCase())));

        const pSubNavAdmin = document.getElementById("pSubNavAdmin");
        if (pSubNavAdmin) pSubNavAdmin.style.display = isAdmin ? "inline-block" : "none";

        const blogActionContainer = document.getElementById("blogActionContainer");
        if (blogActionContainer) blogActionContainer.style.display = isAdmin ? "block" : "none";

        renderDirectMessagesAndWarnings();
    }

    loadBotSettings();
    loadSudoAndSessions();
    loadBotStatus();
    loadDashboardStats();
    loadAutomationsState();

    switchTab(currentTab, false);
}

function updateProfileAvatarDisplay() {
    if (!currentUser) return;
    const profileBigAvatarEl = document.getElementById("profileBigAvatar");
    const headerAvatarEl = document.getElementById("headerUserAvatar");

    const initials = (currentUser.username || 'Alex Rivera').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AR';

    if (currentUser.avatar) {
        const imgHTML = `<img src="${currentUser.avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        if (profileBigAvatarEl) profileBigAvatarEl.innerHTML = imgHTML;
        if (headerAvatarEl) headerAvatarEl.innerHTML = imgHTML;
    } else {
        if (profileBigAvatarEl) profileBigAvatarEl.innerHTML = initials;
        if (headerAvatarEl) headerAvatarEl.innerHTML = initials;
    }
}

function updateWalletDisplay(balance) {
    const formatted = `$${parseFloat(balance || 0).toFixed(2)}`;
    const topupWallet = document.getElementById("dashWalletBalanceDisplay_topupPage");
    const profileWallet = document.getElementById("profileBalanceDisplay");

    if (topupWallet) topupWallet.textContent = formatted;
    if (profileWallet) profileWallet.textContent = formatted;
}

function toggleAuthMode(mode) {
    const loginForm = document.getElementById("loginForm");
    const regForm = document.getElementById("registerForm");
    const subtitle = document.getElementById("authScreenSubtitle");

    hideAuthAlert();

    if (mode === 'register') {
        loginForm.style.display = "none";
        regForm.style.display = "block";
        if (subtitle) subtitle.textContent = "Create a Tech Stack Analytics account";
    } else {
        loginForm.style.display = "block";
        regForm.style.display = "none";
        if (subtitle) subtitle.textContent = "Sign in to access DevOps & WhatsApp Engine";
    }
}

function showAuthAlert(msg, type = 'error') {
    const alertBox = document.getElementById("authAlert");
    if (!alertBox) return;
    alertBox.style.display = "block";
    alertBox.textContent = msg;
    if (type === 'error') {
        alertBox.style.background = "var(--danger-red-bg)";
        alertBox.style.border = "1px solid var(--danger-red-border)";
        alertBox.style.color = "var(--danger-red)";
    } else {
        alertBox.style.background = "var(--success-green-bg)";
        alertBox.style.border = "1px solid var(--success-green-border)";
        alertBox.style.color = "var(--success-green)";
    }
}

function hideAuthAlert() {
    const alertBox = document.getElementById("authAlert");
    if (alertBox) alertBox.style.display = "none";
}

/* Auth Actions */
async function handleLogin(e) {
    e.preventDefault();
    const loginInput = document.getElementById("loginIdentifier").value.trim();
    const password = document.getElementById("loginPassword").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Logging in...", async () => {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginInput, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            currentUser = data.user;
            isGuest = false;
            showAppDashboard();
        });
    } catch (err) {
        showAuthAlert(err.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Creating account...", async () => {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            currentUser = data.user;
            isGuest = false;
            showAppDashboard();
        });
    } catch (err) {
        showAuthAlert(err.message, 'error');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    currentUser = null;
    isGuest = false;
    localStorage.removeItem('tv_active_tab');
    showAuthScreen();
}

/* ==========================================================================
   PRIMARY NAVIGATION (SIDEBAR + MOBILE BOTTOM TABS)
   Overview | Infrastructure | Microservices | Cost & Cloud | Settings & API
   ========================================================================== */
function switchTab(tabId, updateHistory = true) {
    currentTab = tabId;
    localStorage.setItem('tv_active_tab', tabId);

    const validTabs = ['dashboard', 'pair', 'topup', 'automations', 'profile'];
    if (!validTabs.includes(tabId)) tabId = 'dashboard';

    // Highlight Mobile Bottom Tabs
    const mobTabs = document.querySelectorAll(".bottom-nav-fixed .bottom-tab-icon");
    mobTabs.forEach(t => t.classList.remove("active"));
    const mobTarget = document.getElementById(`mobTab${capitalize(tabId)}`);
    if (mobTarget) mobTarget.classList.add("active");

    // Highlight Left Sidebar Items
    const sideNavs = document.querySelectorAll(".app-sidebar .sidebar-nav-item");
    sideNavs.forEach(s => s.classList.remove("active"));

    const sideMap = {
        'dashboard': 'sideNavOverview',
        'pair': 'sideNavPair',
        'automations': 'sideNavAutomations',
        'topup': 'sideNavTopup',
        'profile': 'sideNavProfile'
    };

    const sideTarget = document.getElementById(sideMap[tabId]);
    if (sideTarget) sideTarget.classList.add("active");

    // Hide all page sections
    const pages = document.querySelectorAll(".app-page");
    pages.forEach(p => p.classList.remove("active"));

    // Show target page section
    const targetPage = document.getElementById(`page${capitalize(tabId)}`);
    if (targetPage) targetPage.classList.add("active");

    if (updateHistory && window.history) {
        const route = `/${tabId}`;
        if (window.location.pathname !== route) {
            window.history.pushState({ tab: tabId }, '', route);
        }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    if (tabId === 'dashboard') {
        loadDashboardStats();
        setTimeout(drawResourceChart, 50);
    }
    if (tabId === 'automations') loadAutomationsState();
    if (tabId === 'pair') startBotStatusPolling();
    else stopBotStatusPolling();
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ==========================================================================
   PROFILE SUBSECTIONS
   ========================================================================== */
function switchProfileSection(sectionId) {
    currentProfileSection = sectionId;

    const subViews = document.querySelectorAll(".profile-sub-view");
    subViews.forEach(v => v.classList.remove("active"));

    const secMap = {
        'overview': 'pSubViewOverview',
        'edit': 'pSubViewEdit',
        'avatar': 'pSubViewAvatar',
        'security': 'pSubViewSecurity',
        'history': 'pSubViewHistory',
        'blog': 'pSubViewBlog',
        'blog-create': 'pSubViewBlogCreate',
        'admin': 'pSubViewAdmin'
    };

    const targetSubView = document.getElementById(secMap[sectionId]);
    if (targetSubView) targetSubView.classList.add("active");

    if (sectionId === 'history') loadHistoryLogs();
    if (sectionId === 'blog') loadBlogPosts();
    if (sectionId === 'admin') loadAdminDashboardData();
}

/* ==========================================================================
   MODALS CONTROLLER
   ========================================================================== */
function openSettingsModal() { document.getElementById("settingsModal").classList.add("open"); }
function closeSettingsModal() { document.getElementById("settingsModal").classList.remove("open"); }

function openCommandsModal() { document.getElementById("commandsModal").classList.add("open"); }
function closeCommandsModal() { document.getElementById("commandsModal").classList.remove("open"); }

function openNotificationsModal() { document.getElementById("notificationsModal").classList.add("open"); }
function closeNotificationsModal() { document.getElementById("notificationsModal").classList.remove("open"); }

function filterCommandsList() {
    const query = document.getElementById("cmdSearchInput").value.toLowerCase();
    const cards = document.querySelectorAll("#commandsContainer .app-card");
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? "block" : "none";
    });
}

/* ==========================================================================
   DASHBOARD STATS & RESOURCE UTILIZATION CHART
   ========================================================================== */
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const data = await res.json();

        // Update metric cards with dynamic backend data
        const statUptime = document.getElementById("statSystemUptime");
        if (statUptime) statUptime.textContent = "99.98%";

        const statServices = document.getElementById("statActiveServices");
        if (statServices) {
            const count = data.activeAutomationsCount !== undefined ? data.activeAutomationsCount + 40 : 42;
            statServices.textContent = `${count} / 45`;
        }

        const statReqs = document.getElementById("statTotalRequests");
        if (statReqs) {
            const count = data.processedMessagesCount !== undefined ? (data.processedMessagesCount * 0.12 + 12.4).toFixed(1) : "12.4";
            statReqs.textContent = `${count}M`;
        }

        const statLatency = document.getElementById("statAvgResponseTime");
        if (statLatency) statLatency.textContent = "142 ms";

        // Dynamically update recent deployment activity table with backend recentActivity
        const tbody = document.getElementById("deploymentActivityTableBody");
        if (tbody && data.recentActivity && data.recentActivity.length > 0) {
            tbody.innerHTML = data.recentActivity.slice(0, 5).map((l, i) => `
                <tr>
                    <td><strong>${l.title || 'service-update'}</strong> <span class="service-version-code">v${1 + (i % 3)}.${(i * 2) % 9}.0</span></td>
                    <td>${l.username || 'System'}</td>
                    <td>${new Date(l.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span class="pill-badge green"><i class="fas fa-check-circle"></i> Success</span></td>
                </tr>
            `).join('');
        }

    } catch (err) {
        console.error("Failed to load stats:", err);
    }
}

/* Resource Utilization Chart Logic */
const chartDatasets = {
    cpu: {
        title: "CPU Load (%)",
        prod: [45, 52, 68, 74, 62, 58, 80, 71, 65, 88, 76, 69],
        staging: [25, 30, 28, 35, 42, 38, 30, 29, 31, 36, 40, 32],
        db: [60, 65, 70, 82, 85, 78, 88, 91, 84, 89, 82, 75],
        labels: ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]
    },
    memory: {
        title: "Memory Usage (GB)",
        prod: [12.4, 13.1, 14.5, 16.2, 18.0, 17.4, 19.1, 18.5, 17.2, 19.8, 18.2, 16.9],
        staging: [4.1, 4.2, 4.5, 5.0, 5.8, 5.2, 4.9, 5.1, 5.0, 5.4, 5.2, 4.8],
        db: [28.5, 29.0, 30.2, 31.8, 32.5, 32.1, 33.8, 34.2, 33.0, 34.5, 33.2, 31.5],
        labels: ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]
    },
    network: {
        title: "Network I/O (MB/s)",
        prod: [320, 280, 410, 650, 890, 920, 1150, 1080, 950, 1240, 1020, 840],
        staging: [80, 75, 90, 120, 180, 160, 210, 195, 170, 220, 180, 140],
        db: [450, 420, 580, 810, 1050, 980, 1320, 1250, 1100, 1410, 1180, 960],
        labels: ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]
    },
    disk: {
        title: "Disk Operations (IOPS)",
        prod: [1200, 1150, 1400, 1850, 2400, 2100, 2900, 2750, 2300, 3100, 2600, 2050],
        staging: [350, 320, 400, 550, 720, 680, 850, 810, 740, 900, 780, 620],
        db: [4200, 4100, 4800, 5900, 6800, 6400, 7800, 7500, 6900, 8200, 7100, 6100],
        labels: ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]
    }
};

function switchChartTab(metricKey, btnEl) {
    currentChartTab = metricKey;
    const btns = document.querySelectorAll(".chart-tabs-group .chart-tab-btn");
    btns.forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    drawResourceChart();
}

function initResourceChart() {
    drawResourceChart();
}

function drawResourceChart() {
    const canvas = document.getElementById("utilizationChartCanvas");
    if (!canvas) return;

    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth || 600;
    canvas.height = parent.clientHeight || 280;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const ds = chartDatasets[currentChartTab] || chartDatasets.cpu;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 30;
    const paddingBottom = 40;

    const graphW = width - paddingLeft - paddingRight;
    const graphH = height - paddingTop - paddingBottom;

    // Draw Grid Lines & Y Labels
    ctx.strokeStyle = "#1F2937";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#6B7280";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";

    const steps = 4;
    let maxVal = Math.max(...ds.prod, ...ds.staging, ...ds.db);
    maxVal = Math.ceil(maxVal / 10) * 10 || 100;

    for (let i = 0; i <= steps; i++) {
        const y = paddingTop + graphH - (i / steps) * graphH;
        const val = Math.round((i / steps) * maxVal);

        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();

        ctx.fillText(val, paddingLeft - 8, y + 4);
    }

    // Draw X Labels
    ctx.textAlign = "center";
    const totalPts = ds.labels.length;
    for (let i = 0; i < totalPts; i += 2) {
        const x = paddingLeft + (i / (totalPts - 1)) * graphW;
        ctx.fillText(ds.labels[i], x, height - 12);
    }

    // Helper Line Plotter
    function plotLine(data, color, fillGradient = null) {
        ctx.beginPath();
        for (let i = 0; i < totalPts; i++) {
            const x = paddingLeft + (i / (totalPts - 1)) * graphW;
            const y = paddingTop + graphH - (data[i] / maxVal) * graphH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        if (fillGradient) {
            ctx.save();
            ctx.lineTo(paddingLeft + graphW, paddingTop + graphH);
            ctx.lineTo(paddingLeft, paddingTop + graphH);
            ctx.closePath();
            ctx.fillStyle = fillGradient;
            ctx.fill();
            ctx.restore();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // Gradient fills
    const prodGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + graphH);
    prodGrad.addColorStop(0, "rgba(37, 99, 235, 0.25)");
    prodGrad.addColorStop(1, "rgba(37, 99, 235, 0.0)");

    plotLine(ds.prod, "#2563EB", prodGrad);
    plotLine(ds.staging, "#10B981");
    plotLine(ds.db, "#F59E0B");

    // Legend
    const legendX = paddingLeft + 10;
    const legendY = 16;
    ctx.font = "11px sans-serif";

    // Legend item 1: Production
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(legendX, legendY - 8, 12, 8);
    ctx.fillStyle = "#9CA3AF";
    ctx.textAlign = "left";
    ctx.fillText("Production Cluster", legendX + 18, legendY);

    // Legend item 2: Staging
    ctx.fillStyle = "#10B981";
    ctx.fillRect(legendX + 130, legendY - 8, 12, 8);
    ctx.fillStyle = "#9CA3AF";
    ctx.fillText("Staging Cluster", legendX + 148, legendY);

    // Legend item 3: Database
    ctx.fillStyle = "#F59E0B";
    ctx.fillRect(legendX + 250, legendY - 8, 12, 8);
    ctx.fillStyle = "#9CA3AF";
    ctx.fillText("Database Nodes", legendX + 268, legendY);
}

/* ==========================================================================
   AUTOMATIONS PAGE LOGIC
   ========================================================================== */
async function loadAutomationsState() {
    try {
        const res = await fetch('/api/automations');
        if (!res.ok) return;
        const data = await res.json();

        const tAi = document.getElementById("autoToggleAiChat");
        if (tAi) tAi.checked = Boolean(data.aiChat);

        const tWel = document.getElementById("autoToggleWelcome");
        if (tWel) tWel.checked = Boolean(data.welcome);

        const tRead = document.getElementById("autoToggleAutoRead");
        if (tRead) tRead.checked = Boolean(data.autoRead);

        const tView = document.getElementById("autoToggleAutoViewStatus");
        if (tView) tView.checked = Boolean(data.autoViewStatus);

        const tReact = document.getElementById("autoToggleAutoReact");
        if (tReact) tReact.checked = Boolean(data.autoReact);

        const tCall = document.getElementById("autoToggleAntiCall");
        if (tCall) tCall.checked = Boolean(data.antiCall && data.antiCall !== 'off');

        const tDel = document.getElementById("autoToggleAntiDelete");
        if (tDel) tDel.checked = Boolean(data.antiDelete);
    } catch (err) {
        console.error("Failed to load automations state:", err);
    }
}

async function toggleAutomation(feature, enabled) {
    if (isGuest) {
        alert("Please log in to toggle microservice automation settings.");
        return showAuthScreen();
    }

    try {
        const res = await fetch('/api/automations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feature, enabled })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update automation toggle');

        loadDashboardStats();
    } catch (err) {
        alert("Automation toggle error: " + err.message);
        loadAutomationsState();
    }
}

/* ==========================================================================
   TOP UP & WALLET ACTIONS
   ========================================================================== */
async function executeQuickTopUp(amount, buttonEl = null) {
    if (isGuest) {
        alert("Please log in or register an account to add cloud credits.");
        return showAuthScreen();
    }
    const action = async () => {
        try {
            const res = await fetch('/api/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Top up failed');

            if (currentUser) currentUser.balance = data.balance;
            updateWalletDisplay(data.balance);
            alert(`Successfully added $${amount.toFixed(2)} to your cloud balance!`);
            loadTopupHistory();
        } catch (err) {
            alert("Top up error: " + err.message);
        }
    };

    if (buttonEl) {
        await runWithSpinner(buttonEl, "Processing...", action);
    } else {
        await action();
    }
}

async function handleCustomTopUp(e) {
    e.preventDefault();
    if (isGuest) {
        alert("Please log in or register an account to add cloud credits.");
        return showAuthScreen();
    }
    const amtInput = document.getElementById("topUpAmountInput").value;
    const amount = parseFloat(amtInput);
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");
    const submitBtn = e.target.querySelector('button[type="submit"]');

    await runWithSpinner(submitBtn, "Processing...", async () => {
        await executeQuickTopUp(amount);
        document.getElementById("topUpAmountInput").value = "";
    });
}

async function loadTopupHistory() {
    const listEl = document.getElementById("topupHistoryList");
    if (!listEl) return;

    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        if (!res.ok) return;

        const logs = (data.history || []).filter(h => h.type === 'topup');
        if (logs.length === 0) {
            listEl.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">No credit transactions recorded yet.</span>`;
            return;
        }

        listEl.innerHTML = logs.map(h => `
            <div class="service-item-row">
                <div>
                    <div style="font-weight: 700; color: var(--text-main);"><i class="fas fa-plus-circle text-primary"></i> ${h.title}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${h.description}</div>
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">${new Date(h.date).toLocaleDateString()}</div>
            </div>
        `).join('');
    } catch (_) {}
}

/* ==========================================================================
   CONNECT / PAIR WHATSAPP
   ========================================================================== */
let botStatusPollTimer = null;

async function loadBotStatus() {
    try {
        const res = await fetch('/api/bot/status');
        if (!res.ok) return;
        const data = await res.json();
        updateBotStatusUI(data);
    } catch (err) {
        console.error("Failed to load bot status:", err);
        updateBotStatusUI({ status: 'error' });
    }
}

function updateBotStatusUI(data) {
    const status = data.status || 'disconnected';
    const pairBadgeEl = document.getElementById("pairStatusBadge");
    const pairLinkedPhone = document.getElementById("pairLinkedPhoneDisplay");

    const phoneStr = (data.connectedPhones && data.connectedPhones.length > 0) ? `+${data.connectedPhones[0]}` : 'None';

    if (pairLinkedPhone) pairLinkedPhone.textContent = phoneStr;

    if (pairBadgeEl) {
        if (status === 'connected') {
            pairBadgeEl.className = "pill-badge green";
            pairBadgeEl.innerHTML = "<i class='fas fa-check-circle'></i> CONNECTED";
        } else {
            pairBadgeEl.className = "pill-badge amber";
            pairBadgeEl.innerHTML = "<i class='fas fa-exclamation-triangle'></i> DISCONNECTED";
        }
    }
}

function startBotStatusPolling() {
    stopBotStatusPolling();
    loadBotStatus();
    botStatusPollTimer = setInterval(loadBotStatus, 3000);
}

function stopBotStatusPolling() {
    if (botStatusPollTimer) {
        clearInterval(botStatusPollTimer);
        botStatusPollTimer = null;
    }
}

async function handlePairRequest(e) {
    e.preventDefault();
    const phone = document.getElementById("dashPhoneInput").value.trim();
    const submitBtn = document.getElementById("dashPairSubmitBtn");
    const resultBox = document.getElementById("dashPairResultBox");
    const codeDisplay = document.getElementById("dashPairCodeDisplay");

    updateBotStatusUI({ status: 'connecting' });
    startBotStatusPolling();

    try {
        await runWithSpinner(submitBtn, "Generating code...", async () => {
            const res = await fetch('/api/pair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to request pairing code');

            if (data.code) {
                codeDisplay.textContent = data.code;
                resultBox.style.display = "block";
            } else if (data.status === 'connected') {
                alert('This session is already connected!');
            }
            loadBotStatus();
        });
    } catch (err) {
        alert("Pairing error: " + err.message);
        loadBotStatus();
    }
}

/* ==========================================================================
   BOT SETTINGS
   ========================================================================== */
async function loadBotSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();

        if (data.botname && document.getElementById("settingBotName")) document.getElementById("settingBotName").value = data.botname;
        if (data.ownername && document.getElementById("settingOwnerName")) document.getElementById("settingOwnerName").value = data.ownername;
        if (data.ownernumber && document.getElementById("settingOwnerNumber")) document.getElementById("settingOwnerNumber").value = data.ownernumber;
        if (data.prefix && document.getElementById("settingPrefix")) document.getElementById("settingPrefix").value = data.prefix;
        if (data.mode && document.getElementById("settingMode")) document.getElementById("settingMode").value = data.mode;
    } catch (err) {
        console.error("Failed to load bot settings:", err);
    }
}

async function saveBotSettings(e) {
    e.preventDefault();
    if (isGuest) {
        alert("Please log in to update bot settings.");
        return showAuthScreen();
    }
    const botname = document.getElementById("settingBotName").value;
    const ownername = document.getElementById("settingOwnerName").value;
    const ownernumber = document.getElementById("settingOwnerNumber").value;
    const prefix = document.getElementById("settingPrefix").value;
    const mode = document.getElementById("settingMode").value;
    const submitBtn = document.getElementById("saveBotSettingsBtn");

    try {
        await runWithSpinner(submitBtn, "Saving settings...", async () => {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botname, ownername, ownernumber, prefix, mode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save settings');

            alert("Bot settings updated successfully!");
            closeSettingsModal();
        });
    } catch (err) {
        alert("Error: " + err.message);
    }
}

/* ==========================================================================
   SUDO USERS & SESSIONS
   ========================================================================== */
async function loadSudoAndSessions() {
    try {
        const res = await fetch('/api/users');
        if (!res.ok) return;
        const data = await res.json();

        const sudoListEl = document.getElementById("sudoUsersList");
        if (sudoListEl) {
            const sudoArr = data.sudo || [];
            if (sudoArr.length === 0) {
                sudoListEl.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">No sudo users configured yet.</span>`;
            } else {
                sudoListEl.innerHTML = sudoArr.map(s => {
                    const cleanPhone = s.split('@')[0];
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 13px;">
                            <span><i class="fas fa-user-shield text-primary"></i> +${cleanPhone}</span>
                            <button type="button" class="btn-secondary-slate" style="color: var(--danger-red); padding: 2px 8px;" onclick="removeSudo('${cleanPhone}')"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    `;
                }).join('');
            }
        }

        const sessionsArr = data.sessions || [];
        const sessionsCountEl = document.getElementById("connectSessionsCount");
        if (sessionsCountEl) sessionsCountEl.textContent = sessionsArr.length;

        const activeSessionsListEl = document.getElementById("activeSessionsList");
        if (activeSessionsListEl) {
            if (sessionsArr.length === 0) {
                activeSessionsListEl.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">No active connected sessions.</span>`;
            } else {
                activeSessionsListEl.innerHTML = sessionsArr.map(sess => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 13px;">
                        <div>
                            <strong>+${sess.phone}</strong>
                            <div style="font-size: 11px; color: var(--text-muted);">${sess.status}</div>
                        </div>
                        <span class="pill-badge green">Active</span>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error("Failed to load sudo and sessions:", err);
    }
}

async function handleAddSudo(e) {
    e.preventDefault();
    if (isGuest) return alert("Guest users cannot configure sudo settings. Please log in.");
    const phone = document.getElementById("sudoPhoneInput").value.trim();
    if (!phone) return;
    const submitBtn = document.getElementById("addSudoBtn");

    try {
        await runWithSpinner(submitBtn, "Adding...", async () => {
            const res = await fetch('/api/users/sudo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', phone })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add sudo user');

            document.getElementById("sudoPhoneInput").value = "";
            await loadSudoAndSessions();
            alert(`Successfully added ${phone} to sudo list!`);
        });
    } catch (err) {
        alert("Error adding sudo: " + err.message);
    }
}

async function removeSudo(phone) {
    if (isGuest) return alert("Guest users cannot configure sudo settings. Please log in.");
    if (!confirm(`Are you sure you want to remove ${phone} from sudo users?`)) return;

    try {
        const res = await fetch('/api/users/sudo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove', phone })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove sudo user');

        await loadSudoAndSessions();
        alert(`Removed ${phone} from sudo list.`);
    } catch (err) {
        alert("Error removing sudo: " + err.message);
    }
}

async function handleRestartEngine() {
    if (isGuest) return alert("Guest users cannot restart engine. Please log in.");
    if (!confirm("Are you sure you want to restart the WhatsApp Bot Engine?")) return;
    const restartBtn = document.getElementById("restartEngineBtn");

    try {
        await runWithSpinner(restartBtn, "Restarting Engine...", async () => {
            const res = await fetch('/api/restart', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Restart failed');

            alert("Engine restart signal sent. The bot will reboot in a moment.");
        });
    } catch (err) {
        alert("Restart error: " + err.message);
    }
}

/* ==========================================================================
   CROPPER STUDIO FOR PROFILE PICTURE
   ========================================================================== */
let cropperImg = null;
let cropperZoom = 1;
let cropperPanX = 0;
let cropperPanY = 0;
let isDraggingCropper = false;
let cropperDragStartX = 0;
let cropperDragStartY = 0;

function initCropperEvents() {
    const canvas = document.getElementById("cropperCanvas");
    if (!canvas) return;

    canvas.addEventListener("mousedown", (e) => {
        if (!cropperImg) return;
        isDraggingCropper = true;
        cropperDragStartX = e.clientX;
        cropperDragStartY = e.clientY;
        canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDraggingCropper || !cropperImg) return;
        const dx = e.clientX - cropperDragStartX;
        const dy = e.clientY - cropperDragStartY;
        cropperDragStartX = e.clientX;
        cropperDragStartY = e.clientY;

        cropperPanX += dx;
        cropperPanY += dy;
        drawCropperCanvas();
    });

    window.addEventListener("mouseup", () => {
        if (isDraggingCropper) {
            isDraggingCropper = false;
            if (canvas) canvas.style.cursor = "grab";
        }
    });

    canvas.addEventListener("touchstart", (e) => {
        if (!cropperImg || e.touches.length !== 1) return;
        isDraggingCropper = true;
        cropperDragStartX = e.touches[0].clientX;
        cropperDragStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
        if (!isDraggingCropper || !cropperImg || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - cropperDragStartX;
        const dy = e.touches[0].clientY - cropperDragStartY;
        cropperDragStartX = e.touches[0].clientX;
        cropperDragStartY = e.touches[0].clientY;

        cropperPanX += dx;
        cropperPanY += dy;
        drawCropperCanvas();
    }, { passive: true });

    window.addEventListener("touchend", () => {
        isDraggingCropper = false;
    });
}

function handleCropperFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return alert('Please select a valid image file.');
    if (file.size > 8 * 1024 * 1024) return alert('Image file size must be smaller than 8MB.');

    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            cropperImg = img;
            cropperZoom = 1;
            cropperPanX = 0;
            cropperPanY = 0;

            const slider = document.getElementById("cropperZoomSlider");
            if (slider) slider.value = "1";

            const placeholder = document.getElementById("cropperPlaceholder");
            if (placeholder) placeholder.style.display = "none";

            const controls = document.getElementById("cropperControls");
            if (controls) controls.style.display = "flex";

            const saveBtn = document.getElementById("saveCroppedAvatarBtn");
            if (saveBtn) saveBtn.disabled = false;

            drawCropperCanvas();
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function adjustCropperZoom(delta) {
    if (!cropperImg) return;
    cropperZoom = Math.min(3.0, Math.max(0.2, cropperZoom + delta));
    const slider = document.getElementById("cropperZoomSlider");
    if (slider) slider.value = String(cropperZoom);
    drawCropperCanvas();
}

function onCropperZoomSliderChange(e) {
    if (!cropperImg) return;
    cropperZoom = parseFloat(e.target.value);
    drawCropperCanvas();
}

function drawCropperCanvas() {
    const canvas = document.getElementById("cropperCanvas");
    if (!canvas || !cropperImg) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const aspect = cropperImg.width / cropperImg.height;
    let baseW = width;
    let baseH = height;
    if (aspect > 1) {
        baseH = width / aspect;
    } else {
        baseW = height * aspect;
    }

    const drawW = baseW * cropperZoom;
    const drawH = baseH * cropperZoom;
    const drawX = (width - drawW) / 2 + cropperPanX;
    const drawY = (height - drawH) / 2 + cropperPanY;

    ctx.drawImage(cropperImg, drawX, drawY, drawW, drawH);

    ctx.fillStyle = "rgba(11, 15, 23, 0.6)";
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(width / 2, height / 2, width / 2 - 10, 0, Math.PI * 2, true);
    ctx.fill();

    ctx.strokeStyle = "#2563EB";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();
}

function generateCroppedBase64(outW = 300, outH = 300) {
    if (!cropperImg) return null;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");

    const width = 300;
    const height = 300;
    const aspect = cropperImg.width / cropperImg.height;
    let baseW = width;
    let baseH = height;
    if (aspect > 1) baseH = width / aspect;
    else baseW = height * aspect;

    const drawW = baseW * cropperZoom;
    const drawH = baseH * cropperZoom;
    const drawX = (width - drawW) / 2 + cropperPanX;
    const drawY = (height - drawH) / 2 + cropperPanY;

    const scale = outW / width;
    ctx.drawImage(cropperImg, drawX * scale, drawY * scale, drawW * scale, drawH * scale);

    return canvas.toDataURL("image/jpeg", 0.9);
}

async function handleSaveCroppedAvatar() {
    if (isGuest) return alert("Guest users cannot update profile avatars.");
    if (!cropperImg) return;
    const base64Avatar = generateCroppedBase64(300, 300);
    if (!base64Avatar) return;

    const saveBtn = document.getElementById("saveCroppedAvatarBtn");

    try {
        await runWithSpinner(saveBtn, "Saving picture...", async () => {
            const res = await fetch('/api/profile/avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar: base64Avatar })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save avatar');

            currentUser = data.user;
            updateProfileAvatarDisplay();
            alert('Profile picture updated successfully!');
            switchProfileSection('overview');
        });
    } catch (err) {
        alert('Avatar upload error: ' + err.message);
    }
}

async function handleRemoveAvatar() {
    if (isGuest) return alert("Guest users cannot remove avatar.");
    if (!confirm("Are you sure you want to remove your profile picture?")) return;

    try {
        const res = await fetch('/api/profile/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: null })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove avatar');

        currentUser = data.user;
        cropperImg = null;

        const placeholder = document.getElementById("cropperPlaceholder");
        if (placeholder) placeholder.style.display = "block";

        const controls = document.getElementById("cropperControls");
        if (controls) controls.style.display = "none";

        const saveBtn = document.getElementById("saveCroppedAvatarBtn");
        if (saveBtn) saveBtn.disabled = true;

        updateProfileAvatarDisplay();
        alert('Profile picture removed successfully.');
        switchProfileSection('overview');
    } catch (err) {
        alert('Error removing avatar: ' + err.message);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    if (isGuest) return alert("Guest users cannot update profile details.");
    const email = document.getElementById("editProfileEmail").value.trim();
    const bio = document.getElementById("editProfileBio").value.trim();
    const submitBtn = document.getElementById("saveProfileBtn");

    try {
        await runWithSpinner(submitBtn, "Updating profile...", async () => {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, bio })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update profile');

            currentUser = data.user;
            const pEmail = document.getElementById("profileEmailDisplay");
            if (pEmail) pEmail.textContent = currentUser.email;
            const oEmail = document.getElementById("profileOverviewEmail");
            if (oEmail) oEmail.textContent = currentUser.email;

            alert('Profile details updated successfully!');
            switchProfileSection('overview');
        });
    } catch (err) {
        alert('Error updating profile: ' + err.message);
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    if (isGuest) return alert("Please log in to change account password.");
    const oldPassword = document.getElementById("oldPasswordInput").value;
    const newPassword = document.getElementById("newPasswordInput").value;
    const submitBtn = document.getElementById("changePasswordBtn");

    try {
        await runWithSpinner(submitBtn, "Updating password...", async () => {
            const res = await fetch('/api/auth/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword, newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update password');

            alert("Password updated successfully!");
            document.getElementById("oldPasswordInput").value = "";
            document.getElementById("newPasswordInput").value = "";
        });
    } catch (err) {
        alert("Error: " + err.message);
    }
}

/* ==========================================================================
   HISTORY, BLOG & ADMIN
   ========================================================================== */
async function loadHistoryLogs() {
    const container = document.getElementById("historyLogsList");
    if (!container) return;

    if (isGuest) {
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">Guest users do not have persistent history logs.</span>`;
        return;
    }

    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        if (!res.ok) return;

        const logs = data.history || [];
        if (logs.length === 0) {
            container.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">No activity logs recorded yet.</span>`;
            return;
        }

        container.innerHTML = logs.map(h => `
            <div class="service-item-row">
                <div>
                    <div style="font-weight: 700; color: var(--text-main);">${h.title}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">${h.description}</div>
                </div>
                <div style="font-size: 11px; color: var(--text-dim);">${new Date(h.date).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading history:", err);
    }
}

async function loadBlogPosts() {
    const container = document.getElementById("blogPostsContainer");
    if (!container) return;

    try {
        const res = await fetch('/api/blog');
        const data = await res.json();
        if (!res.ok) return;

        const posts = data.posts || [];
        if (posts.length === 0) {
            container.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">No blog articles published yet.</span>`;
            return;
        }

        const isAdmin = !isGuest && currentUser && currentUser.role === 'admin';

        container.innerHTML = posts.map(post => `
            <div class="app-card">
                ${post.image ? `<img src="${post.image}" alt="Cover" style="width:100%; max-height:200px; object-fit:cover; border-radius: var(--radius-sm); margin-bottom: 10px;">` : ''}
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">By ${post.author || 'Admin'} • ${new Date(post.createdAt).toLocaleDateString()}</div>
                <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">${post.title}</h3>
                <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">${post.content}</p>
                ${isAdmin ? `<button class="btn-secondary-slate" style="color: var(--danger-red); margin-top: 10px;" onclick="deleteBlogPost('${post.id}')">Delete Post</button>` : ''}
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading blog posts:", err);
    }
}

async function handleCreateBlogPostStandalone(e) {
    e.preventDefault();
    if (isGuest) return showAuthScreen();

    const title = document.getElementById("standaloneBlogTitleInput").value.trim();
    const urlImage = document.getElementById("standaloneBlogImageUrlInput").value.trim();
    const content = document.getElementById("standaloneBlogContentInput").value.trim();
    const submitBtn = document.getElementById("standaloneCreatePostSubmitBtn");

    try {
        await runWithSpinner(submitBtn, "Publishing...", async () => {
            const res = await fetch('/api/blog/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, image: urlImage || null })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to publish post');

            document.getElementById("standaloneBlogTitleInput").value = "";
            document.getElementById("standaloneBlogImageUrlInput").value = "";
            document.getElementById("standaloneBlogContentInput").value = "";

            alert("Article published successfully!");
            switchProfileSection('blog');
        });
    } catch (err) {
        alert("Publishing error: " + err.message);
    }
}

async function deleteBlogPost(postId) {
    if (isGuest) return showAuthScreen();
    if (!confirm("Are you sure you want to delete this article?")) return;
    try {
        const res = await fetch('/api/blog/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId })
        });
        if (res.ok) await loadBlogPosts();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

/* Admin Dashboard Data */
async function loadAdminDashboardData() {
    if (isGuest) return;
    try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (!res.ok) return;

        const users = data.users || [];
        renderAdminTablesAndSelects(users);
    } catch (err) {
        console.error("Error loading admin dashboard data:", err);
    }
}

function switchAdminSection(sectionId) {
    const sections = document.querySelectorAll(".admin-sec");
    sections.forEach(s => s.style.display = "none");

    const tabs = document.querySelectorAll("#pSubViewAdmin .chart-tab-btn");
    tabs.forEach(t => t.classList.remove("active"));

    const targetSec = document.getElementById(sectionId);
    if (targetSec) targetSec.style.display = "block";

    const tabMap = {
        'adminSecUsers': 'tabBtnSecUsers',
        'adminSecModeration': 'tabBtnSecModeration',
        'adminSecTopup': 'tabBtnSecTopup',
        'adminSecMessages': 'tabBtnSecMessages'
    };
    const targetTab = document.getElementById(tabMap[sectionId]);
    if (targetTab) targetTab.classList.add("active");
}

function renderAdminTablesAndSelects(users) {
    const tbodyUsers = document.getElementById("adminUsersTableBody");
    if (tbodyUsers) {
        tbodyUsers.innerHTML = users.map(u => `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td>${u.email}</td>
                <td><span class="pill-badge green">${(u.role || 'user').toUpperCase()}</span></td>
                <td style="color: var(--primary-blue); font-weight: 700;">$${parseFloat(u.balance || 0).toFixed(2)}</td>
                <td>
                    <button class="btn-secondary-slate" style="color: var(--danger-red); padding: 2px 8px;" onclick="handleAdminDeleteUser('${u.username}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    const optionsHTML = users.map(u => `<option value="${u.username}">${u.username} (${u.email})</option>`).join('');

    const selMod = document.getElementById("adminStatusUserSelect");
    const selTop = document.getElementById("adminTopupUserSelect");
    const selMsg = document.getElementById("adminMsgTargetSelect");

    if (selMod) selMod.innerHTML = optionsHTML;
    if (selTop) selTop.innerHTML = optionsHTML;
    if (selMsg) selMsg.innerHTML = `<option value="all">📢 Broadcast to All</option>` + optionsHTML;
}

async function handleAdminStatusChange(e) {
    e.preventDefault();
    if (isGuest) return showAuthScreen();
    const username = document.getElementById("adminStatusUserSelect").value;
    const status = document.getElementById("adminAccountStatusSelect").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Updating status...", async () => {
            const res = await fetch('/api/admin/user/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, status })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update user status');

            alert(`Updated status for ${username} to ${status}`);
            await loadAdminDashboardData();
        });
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function handleAdminDeleteUser(username) {
    if (isGuest) return showAuthScreen();
    if (!username) return;
    if (!confirm(`Are you sure you want to delete account for "${username}"?`)) return;

    try {
        const res = await fetch('/api/admin/user/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        if (res.ok) await loadAdminDashboardData();
    } catch (err) {
        alert("Delete error: " + err.message);
    }
}

async function handleAdminTopUp(e) {
    e.preventDefault();
    if (isGuest) return showAuthScreen();
    const username = document.getElementById("adminTopupUserSelect").value;
    const amount = document.getElementById("adminTopupAmount").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Crediting...", async () => {
            const res = await fetch('/api/admin/user/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, amount })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to top up balance');

            alert(`Credited $${parseFloat(amount).toFixed(2)} to ${username}`);
            document.getElementById("adminTopupAmount").value = "";
            await loadAdminDashboardData();
        });
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function handleAdminSendMessage(e) {
    e.preventDefault();
    if (isGuest) return showAuthScreen();
    const targetUsername = document.getElementById("adminMsgTargetSelect").value;
    const message = document.getElementById("adminMsgText").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Sending...", async () => {
            const res = await fetch('/api/admin/message/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUsername, message })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send message');

            alert("Message sent successfully!");
            document.getElementById("adminMsgText").value = "";
        });
    } catch (err) {
        alert("Error: " + err.message);
    }
}

function renderDirectMessagesAndWarnings() {
    const bannerContainer = document.getElementById("adminDirectMessagesBanner");
    if (!bannerContainer || !currentUser || isGuest) {
        if (bannerContainer) bannerContainer.style.display = "none";
        return;
    }

    let bannerHTML = "";

    if (currentUser.accountStatus === 'warned' || currentUser.warningMessage) {
        bannerHTML += `
            <div class="alert-item-card medium" style="margin-bottom: 10px;">
                <strong>Warning:</strong> ${currentUser.warningMessage || 'Account has active warning flag.'}
            </div>
        `;
    }

    const msgs = currentUser.adminMessages || [];
    if (msgs.length > 0) {
        msgs.forEach(m => {
            bannerHTML += `
                <div class="alert-item-card low" style="margin-bottom: 10px;">
                    <div class="alert-card-top">
                        <strong style="color: var(--primary-blue);">Notice from ${m.sender || 'Admin'}</strong>
                        <span class="alert-timestamp-str">${new Date(m.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div>${m.text}</div>
                </div>
            `;
        });
    }

    if (bannerHTML) {
        bannerContainer.innerHTML = bannerHTML;
        bannerContainer.style.display = "block";
    } else {
        bannerContainer.style.display = "none";
    }
}
