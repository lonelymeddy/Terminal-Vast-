let currentUser = null;
let currentTab = getTabFromPath() || localStorage.getItem('tv_active_tab') || 'dashboard';
let currentProfileSubpage = 'overview';

function getTabFromPath() {
    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!rawPath || rawPath === 'dashboard' || rawPath === 'home') return 'dashboard';
    if (rawPath === 'pair' || rawPath === 'connect') return 'pair';
    if (rawPath === 'topup' || rawPath === 'wallet') return 'topup';
    if (rawPath === 'settings') return 'settings';
    if (rawPath.startsWith('profile') || rawPath === 'blog' || rawPath === 'history' || rawPath === 'admin') return 'profile';
    return null;
}

document.addEventListener("DOMContentLoaded", () => {
    disablePageZoomGestures();
    initClock();
    initCropperEvents();
    checkSession();
});

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

    document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });
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
async function runWithSpinner(buttonEl, loadingText, asyncTaskFn, minMs = 500) {
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
   LIVE CLOCK
   ========================================================================== */
function initClock() {
    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const clockValue = document.getElementById("clockValue");
        if (clockValue) {
            clockValue.textContent = timeStr;
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
            openAuthModal('login');
            renderAuthenticatedUI(); // Render base UI anyway
        }
    } catch (err) {
        console.error("Session check error:", err);
        renderAuthenticatedUI();
    }
}

function renderAuthenticatedUI() {
    const tabFromPath = getTabFromPath();
    if (tabFromPath) currentTab = tabFromPath;

    updateProfileAvatarDisplay();

    if (currentUser) {
        const uDisp = document.getElementById("profileUsernameDisplay");
        if (uDisp) uDisp.textContent = currentUser.username;

        const eDisp = document.getElementById("profileEmailDisplay");
        if (eDisp) eDisp.textContent = currentUser.email || 'N/A';

        const rBadge = document.getElementById("profileRoleBadge");
        if (rBadge) rBadge.textContent = currentUser.role || 'user';

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

        // Check Admin
        const ADMIN_EMAILS = ['delostvoyage@gmail.com', 'voyagedelost@gmail.com'];
        const isAdmin = currentUser.role === 'admin' || (currentUser.email && ADMIN_EMAILS.includes(currentUser.email.trim().toLowerCase()));

        const pSubNavAdmin = document.getElementById("pSubNavAdmin");
        if (pSubNavAdmin) pSubNavAdmin.style.display = isAdmin ? "flex" : "none";

        const blogActionContainer = document.getElementById("blogActionContainer");
        if (blogActionContainer) blogActionContainer.style.display = isAdmin ? "block" : "none";

        renderDirectMessagesAndWarnings();
    }

    // Load initial data
    loadBotSettings();
    loadSudoAndSessions();
    loadBotStatus();

    switchTab(currentTab, false);
}

function updateProfileAvatarDisplay() {
    if (!currentUser) return;
    const topbarAvatarEl = document.getElementById("topbarProfileAvatar");
    const profileBigAvatarEl = document.getElementById("profileBigAvatar");

    if (currentUser.avatar) {
        const imgHTML = `<img src="${currentUser.avatar}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        if (topbarAvatarEl) topbarAvatarEl.innerHTML = imgHTML;
        if (profileBigAvatarEl) profileBigAvatarEl.innerHTML = imgHTML;
    } else {
        const avatarLetter = (currentUser.username || 'U').charAt(0).toUpperCase();
        if (topbarAvatarEl) topbarAvatarEl.innerHTML = `<span style="font-weight:700;">${avatarLetter}</span>`;
        if (profileBigAvatarEl) profileBigAvatarEl.innerHTML = `<span style="font-weight:800; font-size:32px;">${avatarLetter}</span>`;
    }
}

function updateWalletDisplay(balance) {
    const formatted = `$${parseFloat(balance || 0).toFixed(2)}`;
    const dashWallet = document.getElementById("dashWalletBalanceDisplay");
    const topupWallet = document.getElementById("dashWalletBalanceDisplay_topupPage");
    const profileWallet = document.getElementById("profileBalanceDisplay");

    if (dashWallet) dashWallet.textContent = formatted;
    if (topupWallet) topupWallet.textContent = formatted;
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
        if (modalSubtitle) modalSubtitle.textContent = "Create a new Terminal Vast account";
    } else {
        loginForm.style.display = "block";
        regForm.style.display = "none";
        if (modalSubtitle) modalSubtitle.textContent = "Sign in to your account";
    }
}

function showAuthAlert(msg, type = 'error') {
    const alertBox = document.getElementById("authAlert");
    if (!alertBox) return;
    alertBox.style.display = "block";
    alertBox.textContent = msg;
    if (type === 'error') {
        alertBox.style.background = "var(--danger-light)";
        alertBox.style.border = "1px solid var(--danger-border)";
        alertBox.style.color = "var(--danger)";
    } else {
        alertBox.style.background = "var(--success-light)";
        alertBox.style.border = "1px solid var(--success-border)";
        alertBox.style.color = "#059669";
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
    localStorage.removeItem('tv_active_tab');
    openAuthModal('login');
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
   PRIMARY NAVIGATION (5 TABS ROUTER)
   Dashboard | Pair | Top Up | Settings | Profile
   ========================================================================== */
function switchTab(tabId, updateHistory = true) {
    currentTab = tabId;
    localStorage.setItem('tv_active_tab', tabId);

    const validTabs = ['dashboard', 'pair', 'topup', 'settings', 'profile'];
    if (!validTabs.includes(tabId)) tabId = 'dashboard';

    // Highlight Desktop Tabs
    const deskTabs = document.querySelectorAll(".desktop-nav .nav-tab");
    deskTabs.forEach(t => t.classList.remove("active"));
    const deskTarget = document.getElementById(`deskTab${capitalize(tabId)}`);
    if (deskTarget) deskTarget.classList.add("active");

    // Highlight Mobile Bottom Tabs
    const mobTabs = document.querySelectorAll(".bottom-nav .bottom-tab");
    mobTabs.forEach(t => t.classList.remove("active"));
    const mobTarget = document.getElementById(`mobTab${capitalize(tabId)}`);
    if (mobTarget) mobTarget.classList.add("active");

    // Hide all pages
    const pages = document.querySelectorAll(".app-page");
    pages.forEach(p => p.classList.remove("active"));

    // Show target page
    const targetPage = document.getElementById(`page${capitalize(tabId)}`);
    if (targetPage) targetPage.classList.add("active");

    // Push History State
    if (updateHistory && window.history) {
        const route = `/${tabId}`;
        if (window.location.pathname !== route) {
            window.history.pushState({ tab: tabId }, '', route);
        }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Actions on tab switch
    if (tabId === 'pair') startBotStatusPolling();
    else stopBotStatusPolling();
}

/* ==========================================================================
   PROFILE DEDICATED SIDEBAR NAVIGATION
   ========================================================================== */
function switchProfileSubpage(subpageId) {
    currentProfileSubpage = subpageId;

    // Subpage Navigation Links
    const links = document.querySelectorAll(".profile-sidebar .profile-nav-link");
    links.forEach(l => l.classList.remove("active"));

    const navTargetMap = {
        'overview': 'pSubNavOverview',
        'edit': 'pSubNavEdit',
        'avatar': 'pSubNavAvatar',
        'security': 'pSubNavSecurity',
        'history': 'pSubNavHistory',
        'blog': 'pSubNavBlog',
        'blog-create': 'pSubNavBlog',
        'admin': 'pSubNavAdmin'
    };

    const targetLink = document.getElementById(navTargetMap[subpageId]);
    if (targetLink) targetLink.classList.add("active");

    // Subpages Views
    const subpages = document.querySelectorAll(".profile-subpage");
    subpages.forEach(s => s.classList.remove("active"));

    const pageTargetMap = {
        'overview': 'pSubPageOverview',
        'edit': 'pSubPageEdit',
        'avatar': 'pSubPageAvatar',
        'security': 'pSubPageSecurity',
        'history': 'pSubPageHistory',
        'blog': 'pSubPageBlog',
        'blog-create': 'pSubPageBlogCreate',
        'admin': 'pSubPageAdmin'
    };

    const targetSubpage = document.getElementById(pageTargetMap[subpageId]);
    if (targetSubpage) targetSubpage.classList.add("active");

    if (subpageId === 'history') loadHistoryLogs();
    if (subpageId === 'blog') loadBlogPosts();
    if (subpageId === 'admin') loadAdminDashboardData();
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ==========================================================================
   BLOG FUNCTIONALITY
   ========================================================================== */
let uploadedBlogBase64Image = null;

async function loadBlogPosts() {
    const container = document.getElementById("blogPostsContainer");
    if (!container) return;

    try {
        const res = await fetch('/api/blog');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load blog posts');

        const posts = data.posts || [];
        if (posts.length === 0) {
            container.innerHTML = `
                <div class="app-card" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-newspaper" style="font-size: 36px; color: var(--muted-light); margin-bottom: 12px;"></i>
                    <h3 style="color: var(--text);">No blog articles published yet</h3>
                    <p style="color: var(--muted); font-size: 13.5px;">Check back later for updates and announcements.</p>
                </div>
            `;
            return;
        }

        const isAdmin = currentUser && currentUser.role === 'admin';

        container.innerHTML = posts.map(post => {
            const likesCount = (post.likes || []).length;
            const dislikesCount = (post.dislikes || []).length;
            const userLiked = currentUser && (post.likes || []).includes(currentUser.username);
            const userDisliked = currentUser && (post.dislikes || []).includes(currentUser.username);
            const commentsList = post.comments || [];

            return `
                <article class="blog-card" id="blogPostCard_${post.id}">
                    ${post.image ? `<img src="${post.image}" alt="${post.title}" class="blog-img" loading="lazy">` : ''}

                    <div class="blog-meta">
                        <span><i class="fas fa-user-circle" style="color: var(--primary);"></i> ${post.author || 'Admin'}</span>
                        <span>•</span>
                        <span><i class="fas fa-calendar-alt"></i> ${new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>

                    <h2 class="blog-title">${post.title}</h2>
                    <div class="blog-body">${post.content}</div>

                    <div class="blog-footer">
                        <button class="react-btn ${userLiked ? 'active-like' : ''}" onclick="toggleBlogReaction('${post.id}', 'like')">
                            <i class="fas fa-thumbs-up"></i> <span>${likesCount}</span>
                        </button>

                        <button class="react-btn ${userDisliked ? 'active-dislike' : ''}" onclick="toggleBlogReaction('${post.id}', 'dislike')">
                            <i class="fas fa-thumbs-down"></i> <span>${dislikesCount}</span>
                        </button>

                        <span style="font-size: 13px; color: var(--muted); margin-left: auto;">
                            <i class="fas fa-comments"></i> ${commentsList.length} Comments
                        </span>

                        ${isAdmin ? `
                            <button class="btn danger sm" onclick="deleteBlogPost('${post.id}')" title="Delete Article (Admin)">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Comment Section -->
                    <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border);">
                        <form onsubmit="handleAddBlogComment(event, '${post.id}')" style="display: flex; gap: 8px; margin-bottom: 12px;">
                            <input type="text" class="form-control" placeholder="Write a comment..." required style="min-height: 36px; padding: 6px 12px; font-size: 13px;">
                            <button type="submit" class="btn primary sm" style="white-space: nowrap;">Comment</button>
                        </form>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${commentsList.length === 0 ? `<span style="font-size: 12px; color: var(--muted);">No comments yet.</span>` : ''}
                            ${commentsList.map(c => `
                                <div style="background: var(--surface-2); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                        <strong style="color: var(--primary);">${c.username}</strong>
                                        <span style="font-size: 11px; color: var(--muted);">${new Date(c.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    <div style="color: var(--text);">${c.text}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading blog posts:", err);
    }
}

async function toggleBlogReaction(postId, type) {
    if (!currentUser) return openAuthModal('login');
    try {
        const res = await fetch('/api/blog/react', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, type })
        });
        if (res.ok) await loadBlogPosts();
    } catch (err) {
        console.error("Error reacting to blog post:", err);
    }
}

async function handleAddBlogComment(e, postId) {
    e.preventDefault();
    if (!currentUser) return openAuthModal('login');
    const inputEl = e.target.querySelector('input');
    const text = inputEl.value.trim();
    if (!text) return;

    try {
        const res = await fetch('/api/blog/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, text })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to post comment');

        inputEl.value = "";
        await loadBlogPosts();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

let uploadedStandaloneBlogBase64Image = null;

function handleStandaloneBlogImageFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) return alert('Image file size must be smaller than 8MB.');

    const nameDisplay = document.getElementById("standaloneBlogFileNameDisplay");
    if (nameDisplay) nameDisplay.textContent = file.name;

    const reader = new FileReader();
    reader.onload = () => {
        uploadedStandaloneBlogBase64Image = reader.result;
    };
    reader.readAsDataURL(file);
}

async function handleCreateBlogPostStandalone(e) {
    e.preventDefault();
    if (!currentUser) return openAuthModal('login');

    const title = document.getElementById("standaloneBlogTitleInput").value.trim();
    const urlImage = document.getElementById("standaloneBlogImageUrlInput").value.trim();
    const content = document.getElementById("standaloneBlogContentInput").value.trim();
    const submitBtn = document.getElementById("standaloneCreatePostSubmitBtn");

    const finalImage = uploadedStandaloneBlogBase64Image || urlImage || null;

    try {
        await runWithSpinner(submitBtn, "Publishing article...", async () => {
            const res = await fetch('/api/blog/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, image: finalImage })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to publish post');

            document.getElementById("standaloneBlogTitleInput").value = "";
            document.getElementById("standaloneBlogImageUrlInput").value = "";
            document.getElementById("standaloneBlogContentInput").value = "";
            uploadedStandaloneBlogBase64Image = null;
            const nameDisplay = document.getElementById("standaloneBlogFileNameDisplay");
            if (nameDisplay) nameDisplay.textContent = "No file attached";

            alert("Article published successfully!");
            switchProfileSubpage('blog');
        });
    } catch (err) {
        alert("Publishing error: " + err.message);
    }
}

async function deleteBlogPost(postId) {
    if (!confirm("Are you sure you want to delete this blog article?")) return;
    try {
        const res = await fetch('/api/blog/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete post');

        await loadBlogPosts();
        alert("Article deleted successfully.");
    } catch (err) {
        alert("Error: " + err.message);
    }
}

/* ==========================================================================
   HISTORY LOGS
   ========================================================================== */
async function loadHistoryLogs() {
    const container = document.getElementById("historyLogsList");
    if (!container) return;

    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch history logs');

        const logs = data.history || [];
        if (logs.length === 0) {
            container.innerHTML = `<span style="color: var(--muted); font-size: 13px;">No activity history recorded yet.</span>`;
            return;
        }

        container.innerHTML = logs.map(h => `
            <div class="history-item">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: var(--text); font-size: 14px;">${h.title}</strong>
                    <span style="font-size: 11px; color: var(--muted);"><i class="fas fa-clock"></i> ${new Date(h.date).toLocaleString()}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-secondary);">${h.description}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading history logs:", err);
    }
}

/* ==========================================================================
   ADMIN PANEL
   ========================================================================== */
let adminUsersCache = [];

function switchAdminSection(sectionId) {
    const sections = document.querySelectorAll(".admin-sec");
    sections.forEach(s => s.classList.remove("active"));

    const tabs = document.querySelectorAll(".admin-tab-btn");
    tabs.forEach(t => t.classList.remove("active"));

    const targetSec = document.getElementById(sectionId);
    if (targetSec) targetSec.classList.add("active");

    const tabMap = {
        'adminSecUsers': 'tabBtnSecUsers',
        'adminSecModeration': 'tabBtnSecModeration',
        'adminSecTopup': 'tabBtnSecTopup',
        'adminSecMessages': 'tabBtnSecMessages',
        'adminSecRoles': 'tabBtnSecRoles',
        'adminSecPayments': 'tabBtnSecPayments'
    };
    const targetTab = document.getElementById(tabMap[sectionId]);
    if (targetTab) targetTab.classList.add("active");
}

async function loadAdminDashboardData() {
    try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (!res.ok) return;

        adminUsersCache = data.users || [];
        renderAdminTablesAndSelects(adminUsersCache);
    } catch (err) {
        console.error("Error loading admin dashboard data:", err);
    }
}

function renderAdminTablesAndSelects(users) {
    const tbodyUsers = document.getElementById("adminUsersTableBody");
    if (tbodyUsers) {
        tbodyUsers.innerHTML = users.map(u => `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge badge-primary">${(u.role || 'user').toUpperCase()}</span></td>
                <td><span class="badge ${u.accountStatus === 'banned' ? 'badge-danger' : u.accountStatus === 'warned' ? 'badge-warning' : 'badge-success'}">${(u.accountStatus || 'active').toUpperCase()}</span></td>
                <td style="color: var(--primary); font-weight: 700;">$${parseFloat(u.balance || 0).toFixed(2)}</td>
                <td>
                    <button class="btn danger sm" onclick="handleAdminDeleteUser('${u.username}')" title="Delete User">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    const optionsHTML = users.map(u => `<option value="${u.username}">${u.username} (${u.email})</option>`).join('');

    const selMod = document.getElementById("adminStatusUserSelect");
    const selTop = document.getElementById("adminTopupUserSelect");
    const selRole = document.getElementById("adminRoleUserSelect");
    const selMsg = document.getElementById("adminMsgTargetSelect");

    if (selMod) selMod.innerHTML = optionsHTML;
    if (selTop) selTop.innerHTML = optionsHTML;
    if (selRole) selRole.innerHTML = optionsHTML;

    if (selMsg) {
        selMsg.innerHTML = `<option value="all">📢 Broadcast to ALL Users</option>` + optionsHTML;
    }

    const totalUsersEl = document.getElementById("statTotalUsers");
    const totalFundsEl = document.getElementById("statTotalFunds");
    const totalAdminsEl = document.getElementById("statTotalAdmins");

    const totalFunds = users.reduce((acc, curr) => acc + (parseFloat(curr.balance) || 0), 0);
    const totalAdmins = users.filter(u => u.role === 'admin').length;

    if (totalUsersEl) totalUsersEl.textContent = users.length;
    if (totalFundsEl) totalFundsEl.textContent = `$${totalFunds.toFixed(2)}`;
    if (totalAdminsEl) totalAdminsEl.textContent = totalAdmins;

    const tbodyPayments = document.getElementById("adminPaymentsTableBody");
    if (tbodyPayments) {
        tbodyPayments.innerHTML = users.map(u => `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td><span class="badge badge-success">Verified Paid</span></td>
                <td style="color: var(--primary); font-weight: 700;">$${parseFloat(u.balance || 0).toFixed(2)}</td>
                <td><span style="font-size: 12px; color: ${u.accountStatus === 'banned' ? 'var(--danger)' : '#059669'};">${u.accountStatus || 'active'}</span></td>
            </tr>
        `).join('');
    }
}

async function handleAdminStatusChange(e) {
    e.preventDefault();
    const username = document.getElementById("adminStatusUserSelect").value;
    const status = document.getElementById("adminAccountStatusSelect").value;
    const warningMessage = document.getElementById("adminWarningInput").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Updating status...", async () => {
            const res = await fetch('/api/admin/user/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, status, warningMessage })
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
    if (!username) return;
    if (!confirm(`Are you sure you want to permanently delete account for user "${username}"?`)) return;

    try {
        const res = await fetch('/api/admin/user/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete user');

        alert(data.message || `Deleted account for ${username}`);
        await loadAdminDashboardData();
    } catch (err) {
        alert("Delete error: " + err.message);
    }
}

async function handleAdminTopUp(e) {
    e.preventDefault();
    const username = document.getElementById("adminTopupUserSelect").value;
    const amount = document.getElementById("adminTopupAmount").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Crediting funds...", async () => {
            const res = await fetch('/api/admin/user/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, amount })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to top up balance');

            alert(`Successfully credited $${parseFloat(amount).toFixed(2)} to ${username}`);
            document.getElementById("adminTopupAmount").value = "";
            await loadAdminDashboardData();
        });
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function handleAdminSendMessage(e) {
    e.preventDefault();
    const targetUsername = document.getElementById("adminMsgTargetSelect").value;
    const message = document.getElementById("adminMsgText").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Sending message...", async () => {
            const res = await fetch('/api/admin/message/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUsername, message })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send message');

            alert(data.message || "Message sent successfully!");
            document.getElementById("adminMsgText").value = "";
        });
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function handleAdminRoleChange(e) {
    e.preventDefault();
    const username = document.getElementById("adminRoleUserSelect").value;
    const role = document.getElementById("adminRoleSelect").value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        await runWithSpinner(submitBtn, "Updating role...", async () => {
            const res = await fetch('/api/admin/user/role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, role })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update user role');

            alert(`Updated role for ${username} to ${role}`);
            await loadAdminDashboardData();
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

        // Render Sudo Users
        const sudoListEl = document.getElementById("sudoUsersList");
        if (sudoListEl) {
            const sudoArr = data.sudo || [];
            if (sudoArr.length === 0) {
                sudoListEl.innerHTML = `<span style="color: var(--muted); font-size: 13px;">No sudo users configured yet.</span>`;
            } else {
                sudoListEl.innerHTML = sudoArr.map(s => {
                    const cleanPhone = s.split('@')[0];
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px;">
                            <span><i class="fas fa-user-shield" style="color: var(--primary); margin-right: 8px;"></i> ${cleanPhone}</span>
                            <button type="button" class="btn danger sm" onclick="removeSudo('${cleanPhone}')"><i class="fas fa-trash-alt"></i></button>
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
                activeSessionsListEl.innerHTML = `<span style="color: var(--muted); font-size: 13px;">No active connected sessions.</span>`;
            } else {
                activeSessionsListEl.innerHTML = sessionsArr.map(sess => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px;">
                        <div>
                            <strong style="color: var(--text);"><i class="fab fa-whatsapp" style="color: #10b981; margin-right: 6px;"></i> +${sess.phone}</strong>
                            <div style="font-size: 11px; color: var(--muted);">Status: ${sess.status}</div>
                        </div>
                        <span class="badge badge-success"><span class="badge-dot"></span> Active</span>
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

    // Touch events for mobile support
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

    canvas.addEventListener("wheel", (e) => {
        if (!cropperImg) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        adjustCropperZoom(delta);
    }, { passive: false });
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

function resetCropperPosition() {
    if (!cropperImg) return;
    cropperZoom = 1;
    cropperPanX = 0;
    cropperPanY = 0;
    const slider = document.getElementById("cropperZoomSlider");
    if (slider) slider.value = "1";
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

    ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(width / 2, height / 2, width / 2 - 10, 0, Math.PI * 2, true);
    ctx.fill();

    ctx.strokeStyle = "var(--primary, #2563eb)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, width / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();
}

function generateCroppedBase64(outW = 400, outH = 400) {
    if (!cropperImg) return null;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");

    const width = 340;
    const height = 340;
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

    const scale = outW / width;
    ctx.drawImage(cropperImg, drawX * scale, drawY * scale, drawW * scale, drawH * scale);

    return canvas.toDataURL("image/jpeg", 0.9);
}

async function handleSaveCroppedAvatar() {
    if (!cropperImg) return;
    const base64Avatar = generateCroppedBase64(400, 400);
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
            switchProfileSubpage('overview');
        });
    } catch (err) {
        alert('Avatar upload error: ' + err.message);
    }
}

async function handleRemoveAvatar() {
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
        switchProfileSubpage('overview');
    } catch (err) {
        alert('Error removing avatar: ' + err.message);
    }
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
            const pEmail = document.getElementById("profileEmailDisplay");
            if (pEmail) pEmail.textContent = currentUser.email;
            alert('Profile details updated successfully!');
            switchProfileSubpage('overview');
        });
    } catch (err) {
        alert('Error updating profile: ' + err.message);
    }
}

function renderDirectMessagesAndWarnings() {
    const bannerContainer = document.getElementById("adminDirectMessagesBanner");
    if (!bannerContainer || !currentUser) return;

    let bannerHTML = "";

    if (currentUser.accountStatus === 'warned' || currentUser.warningMessage) {
        bannerHTML += `
            <div style="padding: 14px 18px; background: var(--warning-light); border: 1px solid var(--warning-border); border-radius: var(--radius); color: #d97706; font-size: 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 18px;"></i>
                <div><strong>Account Warning:</strong> ${currentUser.warningMessage || 'Your account has an active warning flag.'}</div>
            </div>
        `;
    } else if (currentUser.accountStatus === 'restricted' || currentUser.accountStatus === 'banned') {
        bannerHTML += `
            <div style="padding: 14px 18px; background: var(--danger-light); border: 1px solid var(--danger-border); border-radius: var(--radius); color: var(--danger); font-size: 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <i class="fas fa-ban" style="font-size: 18px;"></i>
                <div><strong>Account Notice (${currentUser.accountStatus.toUpperCase()}):</strong> ${currentUser.warningMessage || 'Account access is restricted.'}</div>
            </div>
        `;
    }

    const msgs = currentUser.adminMessages || [];
    if (msgs.length > 0) {
        msgs.forEach(m => {
            bannerHTML += `
                <div style="padding: 14px 18px; background: var(--primary-light); border: 1px solid var(--primary-border); border-radius: var(--radius); color: var(--text); font-size: 14px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong style="color: var(--primary);"><i class="fas fa-envelope"></i> Message from ${m.sender || 'Admin'}</strong>
                        <span style="font-size: 11px; color: var(--muted);">${new Date(m.createdAt).toLocaleString()}</span>
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
    if (!currentUser) return openAuthModal('login');
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

    await runWithSpinner(submitBtn, "Processing...", async () => {
        await executeQuickTopUp(amount);
        closeTopUpModal();
        document.getElementById("topUpAmountInput").value = "";
    });
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
    const badgeEl = document.getElementById("botStatusBadge");
    const textEl = document.getElementById("botStatusText");
    const phonesEl = document.getElementById("botConnectedPhonesText");
    const uptimeEl = document.getElementById("botUptimeText");
    const sessionsEl = document.getElementById("botSessionsCountText");

    if (phonesEl) {
        if (data.connectedPhones && data.connectedPhones.length > 0) {
            phonesEl.textContent = data.connectedPhones.map(p => `+${p}`).join(', ');
        } else {
            phonesEl.textContent = 'None';
        }
    }

    if (uptimeEl) uptimeEl.textContent = data.uptime || '--';
    if (sessionsEl) sessionsEl.textContent = data.activeSessionsCount !== undefined ? data.activeSessionsCount : '0';

    if (!badgeEl || !textEl) return;

    if (status === 'connected') {
        badgeEl.className = "badge badge-success";
        textEl.textContent = "CONNECTED";
    } else if (status === 'connecting') {
        badgeEl.className = "badge badge-warning";
        textEl.textContent = "CONNECTING...";
    } else if (status === 'reconnecting') {
        badgeEl.className = "badge badge-warning";
        textEl.textContent = "RECONNECTING...";
    } else if (status === 'error') {
        badgeEl.className = "badge badge-danger";
        textEl.textContent = "ERROR";
    } else {
        badgeEl.className = "badge badge-neutral";
        textEl.textContent = "DISCONNECTED";
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
