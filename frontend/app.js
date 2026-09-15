let currentUser = null;
let currentActivePage = getPageFromPath() || localStorage.getItem('tv_active_page') || 'topup';

function getPageFromPath() {
    const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
    const validPages = ['topup', 'connect', 'settings', 'profile'];
    if (validPages.includes(pathname.toLowerCase())) {
        return pathname.toLowerCase();
    }
    return null;
}

document.addEventListener("DOMContentLoaded", () => {
    disablePageZoomGestures();
    initLandingPageEvents();
    initClock();
    checkSession();
});

function disablePageZoomGestures() {
    // Prevent multi-touch gesture zoom (iOS Safari)
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });

    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    // Prevent Ctrl + Wheel zoom
    document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });
}

window.addEventListener("popstate", () => {
    const page = getPageFromPath() || 'topup';
    if (currentUser) {
        navigateToPage(page, false);
    }
});

/* ==========================================================================
   LOADING SPINNER HELPER (Minimum 6 Seconds Load)
   ========================================================================== */
async function runWithSpinner(buttonEl, loadingText, asyncTaskFn, minMs = 6000) {
    if (!buttonEl) return await asyncTaskFn();
    const originalText = buttonEl.innerHTML;
    const isPrimary = buttonEl.classList.contains("primary");
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

    const reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                }
            });
        }, { threshold: 0.01, rootMargin: "0px 0px 100px 0px" });
        reveals.forEach(el => observer.observe(el));
    } else {
        reveals.forEach(el => el.classList.add("visible"));
    }
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

    const pathPage = getPageFromPath();
    const savedPage = localStorage.getItem('tv_active_page');
    if (pathPage) {
        currentActivePage = pathPage;
    } else if (savedPage) {
        currentActivePage = savedPage;
    }

    // Update Topbar Avatar & Info
    updateProfileAvatarDisplay();

    document.getElementById("profileUsernameDisplay").textContent = currentUser.username;
    document.getElementById("profileEmailDisplay").textContent = currentUser.email || 'N/A';
    document.getElementById("profileRoleBadge").textContent = currentUser.role || 'user';

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

    // Initial load for dashboard pages
    loadBotSettings();
    loadSudoAndSessions();
    navigateToPage(currentActivePage);
}

function updateProfileAvatarDisplay() {
    if (!currentUser) return;
    const topbarAvatarEl = document.getElementById("topbarProfileAvatar");
    const profileBigAvatarEl = document.getElementById("profileBigAvatar");

    if (currentUser.avatar) {
        if (topbarAvatarEl) {
            topbarAvatarEl.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        }
        if (profileBigAvatarEl) {
            profileBigAvatarEl.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        }
    } else {
        const avatarLetter = (currentUser.username || 'U').charAt(0).toUpperCase();
        if (topbarAvatarEl) topbarAvatarEl.textContent = avatarLetter;
        if (profileBigAvatarEl) profileBigAvatarEl.textContent = avatarLetter;
    }
}

function renderUnauthenticatedUI() {
    document.getElementById("landingView").style.display = "block";
    document.getElementById("dashboardContainer").classList.remove("active");
    closeSidebar();
}

function updateWalletDisplay(balance) {
    const formatted = `$${parseFloat(balance || 0).toFixed(2)}`;
    const landingWallet = document.getElementById("landingWalletBalance");
    const dashWallet = document.getElementById("dashWalletBalanceDisplay");
    const profileWallet = document.getElementById("profileBalanceDisplay");

    if (landingWallet) landingWallet.textContent = formatted;
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
        modalSubtitle.textContent = "Account Authentication";
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
            closeAuthModal();
            renderAuthenticatedUI();
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
            closeAuthModal();
            renderAuthenticatedUI();
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
    localStorage.removeItem('tv_active_page');
    renderUnauthenticatedUI();
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const oldPassword = document.getElementById("oldPasswordInput").value;
    const newPassword = document.getElementById("newPasswordInput").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

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
   SUDO USERS, SESSIONS & ENGINE RESTART LOGIC
   ========================================================================== */
async function loadSudoAndSessions() {
    try {
        const res = await fetch('/api/users');
        if (!res.ok) return;
        const data = await res.json();

        // Render Sudo Users
        const sudoListEl = document.getElementById("sudoUsersList");
        if (sudoListEl) {
            const sudoArr = data.sudo || [];
            if (sudoArr.length === 0) {
                sudoListEl.innerHTML = `<span style="color: var(--muted-2); font-size: 13px;">No sudo users configured yet.</span>`;
            } else {
                sudoListEl.innerHTML = sudoArr.map(s => {
                    const cleanPhone = s.split('@')[0];
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--surface-2); border-radius: var(--radius); font-size: 13px;">
                            <span><i class="fas fa-user-shield" style="color: var(--orange); margin-right: 8px;"></i> ${cleanPhone}</span>
                            <button type="button" class="button danger sm" onclick="removeSudo('${cleanPhone}')"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    `;
                }).join('');
            }
        }

        // Render Active Sessions
        const sessionsArr = data.sessions || [];
        const sessionsCountEl = document.getElementById("connectSessionsCount");
        if (sessionsCountEl) sessionsCountEl.textContent = sessionsArr.length;

        const activeSessionsListEl = document.getElementById("activeSessionsList");
        if (activeSessionsListEl) {
            if (sessionsArr.length === 0) {
                activeSessionsListEl.innerHTML = `<span style="color: var(--muted-2); font-size: 13px;">No secondary sessions active.</span>`;
            } else {
                activeSessionsListEl.innerHTML = sessionsArr.map(sess => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface-2); border-radius: var(--radius); font-size: 13px;">
                        <div>
                            <div style="font-weight: 600; color: var(--text);"><i class="fab fa-whatsapp" style="color: #22c55e; margin-right: 6px;"></i> ${sess.phone}</div>
                            <div style="font-size: 11px; color: var(--muted);">Status: ${sess.status}</div>
                        </div>
                        <span class="status-badge-live"><span class="status-dot"></span> Active</span>
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
   PROFILE DETAILS & AVATAR UPLOAD LOGIC
   ========================================================================== */
async function handleAvatarFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be smaller than 5MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
        const base64Avatar = reader.result;
        try {
            const res = await fetch('/api/profile/avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar: base64Avatar })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update avatar');

            currentUser = data.user;
            updateProfileAvatarDisplay();
            alert('Profile picture updated successfully!');
        } catch (err) {
            alert('Avatar upload error: ' + err.message);
        }
    };
    reader.readAsDataURL(file);
}

async function handleProfileUpdate(e) {
    e.preventDefault();
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
            document.getElementById("profileEmailDisplay").textContent = currentUser.email;
            alert('Profile details updated successfully!');
        });
    } catch (err) {
        alert('Error updating profile: ' + err.message);
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

function navigateToPage(pageId, updateHistory = true) {
    currentActivePage = pageId;
    localStorage.setItem('tv_active_page', pageId);
    closeSidebar();

    if (updateHistory && window.history) {
        const targetPath = `/${pageId}`;
        if (window.location.pathname !== targetPath) {
            window.history.pushState({ page: pageId }, '', targetPath);
        }
    }

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
    }, 150);
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

async function executeQuickTopUp(amount, buttonEl = null) {
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
            alert(`Successfully added $${amount.toFixed(2)} to your balance!`);
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
    const amtInput = document.getElementById("topUpAmountInput").value;
    const amount = parseFloat(amtInput);
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");
    const submitBtn = e.target.querySelector('button[type="submit"]');

    await runWithSpinner(submitBtn, "Processing Top Up...", async () => {
        await executeQuickTopUp(amount);
        closeTopUpModal();
        document.getElementById("topUpAmountInput").value = "";
    });
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
        });
    } catch (err) {
        alert("Pairing error: " + err.message);
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
        });
    } catch (err) {
        alert("Error: " + err.message);
    }
}
