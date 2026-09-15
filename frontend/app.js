let currentUser = null;
let currentActivePage = 'topup';

document.addEventListener("DOMContentLoaded", () => {
    initLandingPageEvents();
    initClock();
    checkSession();
});

/* ==========================================================================
   LANDING PAGE EVENTS & INTERACTIVITY
   ========================================================================== */
function initLandingPageEvents() {
    const menuButton = document.getElementById("menuButton");
    const mobileMenu = document.getElementById("mobileMenu");
    const menuLinks = document.querySelectorAll(".menu-link");

    if (menuButton && mobileMenu) {
        menuButton.addEventListener("click", () => {
            const isOpen = mobileMenu.classList.toggle("open");
            menuButton.classList.toggle("active", isOpen);
            menuButton.setAttribute("aria-expanded", String(isOpen));
        });

        menuLinks.forEach(link => {
            link.addEventListener("click", () => {
                menuLinks.forEach(item => item.classList.remove("active"));
                link.classList.add("active");
                mobileMenu.classList.remove("open");
                menuButton.classList.remove("active");
            });
        });
    }

    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach(item => {
        const question = item.querySelector(".faq-question");
        const answer = item.querySelector(".faq-answer");

        if (question && answer) {
            question.addEventListener("click", () => {
                const wasOpen = item.classList.contains("open");
                faqItems.forEach(otherItem => {
                    otherItem.classList.remove("open");
                    const otherAnswer = otherItem.querySelector(".faq-answer");
                    if (otherAnswer) otherAnswer.style.maxHeight = null;
                });

                if (!wasOpen) {
                    item.classList.add("open");
                    answer.style.maxHeight = answer.scrollHeight + "px";
                }
            });
        }
    });

    const yearSpan = document.getElementById("year");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

/* ==========================================================================
   LIVE CLOCK WITH DATE & TIME
   ========================================================================== */
function initClock() {
    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        const dateStr = now.toLocaleDateString();
        const clockValue = document.getElementById("clockValue");
        if (clockValue) {
            clockValue.textContent = `${timeStr} • ${dateStr}`;
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

/* ==========================================================================
   SESSION CHECK & AUTHENTICATION
   ========================================================================== */
async function checkSession() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
            currentUser = data.user;
            renderAuthenticatedUI();
        } else {
            currentUser = null;
            renderUnauthenticatedUI();
        }
    } catch (err) {
        console.error("Session check error:", err);
        renderUnauthenticatedUI();
    }
}

function renderAuthenticatedUI() {
    document.getElementById("landingView").style.display = "none";
    document.getElementById("dashboardContainer").classList.add("active");

    // Update Topbar Info
    const avatarLetter = (currentUser.username || 'U').charAt(0).toUpperCase();
    document.getElementById("topbarProfileAvatar").textContent = avatarLetter;
    document.getElementById("profileBigAvatar").textContent = avatarLetter;

    document.getElementById("profileUsernameDisplay").textContent = currentUser.username;
    document.getElementById("profileEmailDisplay").textContent = currentUser.email || 'N/A';
    document.getElementById("profileRoleBadge").textContent = currentUser.role || 'user';

    updateWalletDisplay(currentUser.balance || 0);

    // Initial load for dashboard pages
    loadBotSettings();
    navigateToPage(currentActivePage);
}

function renderUnauthenticatedUI() {
    document.getElementById("landingView").style.display = "block";
    document.getElementById("dashboardContainer").classList.remove("active");
    closeSidebar();
}

function updateWalletDisplay(balance) {
    const formatted = `$${parseFloat(balance || 0).toFixed(2)}`;
    const landingWallet = document.getElementById("landingWalletBalance");
    const topbarWallet = document.getElementById("topbarBalance");
    const dashWallet = document.getElementById("dashWalletBalanceDisplay");
    const profileWallet = document.getElementById("profileBalanceDisplay");

    if (landingWallet) landingWallet.textContent = formatted;
    if (topbarWallet) topbarWallet.textContent = formatted;
    if (dashWallet) dashWallet.textContent = formatted;
    if (profileWallet) profileWallet.textContent = formatted;
}

/* Modal Helpers */
function openAuthModal(mode = 'login') {
    toggleAuthMode(mode);
    document.getElementById("authModal").classList.add("open");
    hideAuthAlert();
}

function closeAuthModal() {
    document.getElementById("authModal").classList.remove("open");
}

function toggleAuthMode(mode) {
    const loginForm = document.getElementById("loginForm");
    const regForm = document.getElementById("registerForm");
    const modalSubtitle = document.getElementById("authModalSubtitle");

    hideAuthAlert();

    if (mode === 'register') {
        loginForm.style.display = "none";
        regForm.style.display = "block";
        modalSubtitle.textContent = "Create a new Terminal Vast account";
    } else {
        loginForm.style.display = "block";
        regForm.style.display = "none";
        modalSubtitle.textContent = "Internal Offline Authentication System";
    }
}

function showAuthAlert(msg, type = 'error') {
    const alertBox = document.getElementById("authAlert");
    alertBox.style.display = "block";
    alertBox.textContent = msg;
    if (type === 'error') {
        alertBox.style.background = "rgba(239, 68, 68, 0.15)";
        alertBox.style.border = "1px solid rgba(239, 68, 68, 0.4)";
        alertBox.style.color = "#fca5a5";
    } else {
        alertBox.style.background = "rgba(34, 197, 94, 0.15)";
        alertBox.style.border = "1px solid rgba(34, 197, 94, 0.4)";
        alertBox.style.color = "#86efac";
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

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginInput, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        currentUser = data.user;
        closeAuthModal();
        renderAuthenticatedUI();
    } catch (err) {
        showAuthAlert(err.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        currentUser = data.user;
        closeAuthModal();
        renderAuthenticatedUI();
    } catch (err) {
        showAuthAlert(err.message, 'error');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    currentUser = null;
    renderUnauthenticatedUI();
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const oldPassword = document.getElementById("oldPasswordInput").value;
    const newPassword = document.getElementById("newPasswordInput").value;

    try {
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
    } catch (err) {
        alert("Error: " + err.message);
    }
}

/* ==========================================================================
   SIDEBAR & DASHBOARD NAVIGATION
   ========================================================================== */
function toggleSidebar() {
    document.getElementById("sidebarOverlay").classList.toggle("open");
    document.getElementById("sidebarDrawer").classList.toggle("open");
}

function closeSidebar() {
    document.getElementById("sidebarOverlay").classList.remove("open");
    document.getElementById("sidebarDrawer").classList.remove("open");
}

function navigateToPage(pageId) {
    currentActivePage = pageId;
    closeSidebar();

    // Show skeleton loading effect briefly
    showSkeletonLoading();

    // Update active page class
    const pages = document.querySelectorAll(".dash-page");
    pages.forEach(p => p.classList.remove("active"));

    const navLinks = document.querySelectorAll(".sidebar-link");
    navLinks.forEach(link => link.classList.remove("active"));

    setTimeout(() => {
        hideSkeletonLoading();

        const targetPage = document.getElementById(`page${capitalize(pageId)}`);
        if (targetPage) targetPage.classList.add("active");

        const targetNavLink = document.getElementById(`navLink${capitalize(pageId)}`);
        if (targetNavLink) targetNavLink.classList.add("active");
    }, 250);
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function showSkeletonLoading() {
    document.getElementById("dashSkeletonLoading").style.display = "block";
}

function hideSkeletonLoading() {
    document.getElementById("dashSkeletonLoading").style.display = "none";
}

/* ==========================================================================
   TOP UP & WALLET ACTIONS
   ========================================================================== */
function openTopUpModal() {
    document.getElementById("topUpModal").classList.add("open");
}

function closeTopUpModal() {
    document.getElementById("topUpModal").classList.remove("open");
}

async function executeQuickTopUp(amount) {
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
        alert(`Successfully added $${amount.toFixed(2)} to your balance!`);
    } catch (err) {
        alert("Top up error: " + err.message);
    }
}

async function handleCustomTopUp(e) {
    e.preventDefault();
    const amtInput = document.getElementById("topUpAmountInput").value;
    const amount = parseFloat(amtInput);
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");

    await executeQuickTopUp(amount);
    closeTopUpModal();
    document.getElementById("topUpAmountInput").value = "";
}

/* ==========================================================================
   CONNECT WHATSAPP PAIRING
   ========================================================================== */
async function handlePairRequest(e) {
    e.preventDefault();
    const phone = document.getElementById("dashPhoneInput").value.trim();
    const submitBtn = document.getElementById("dashPairSubmitBtn");
    const resultBox = document.getElementById("dashPairResultBox");
    const codeDisplay = document.getElementById("dashPairCodeDisplay");

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating...`;

    try {
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
    } catch (err) {
        alert("Pairing error: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fas fa-bolt"></i> Generate Pairing Code`;
    }
}

/* ==========================================================================
   BOT SETTINGS LOGIC
   ========================================================================== */
async function loadBotSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();

        if (data.botname) document.getElementById("settingBotName").value = data.botname;
        if (data.ownername) document.getElementById("settingOwnerName").value = data.ownername;
        if (data.ownernumber) document.getElementById("settingOwnerNumber").value = data.ownernumber;
        if (data.prefix) document.getElementById("settingPrefix").value = data.prefix;
        if (data.mode) document.getElementById("settingMode").value = data.mode;
    } catch (err) {
        console.error("Failed to load bot settings:", err);
    }
}

async function saveBotSettings(e) {
    e.preventDefault();
    const botname = document.getElementById("settingBotName").value;
    const ownername = document.getElementById("settingOwnerName").value;
    const ownernumber = document.getElementById("settingOwnerNumber").value;
    const prefix = document.getElementById("settingPrefix").value;
    const mode = document.getElementById("settingMode").value;

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botname, ownername, ownernumber, prefix, mode })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save settings');

        alert("Bot settings updated successfully!");
    } catch (err) {
        alert("Error: " + err.message);
    }
}
