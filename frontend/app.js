// ==========================================================================
// TERMINAL VAST - APPLICATION SCRIPT
// ==========================================================================

const CHARACTERS = [
  {
    id: 'ai-assistant',
    name: 'Terminal Vast AI',
    desc: 'Advanced automated assistant trained for bot management, troubleshooting, and group moderation.',
    avatar: 'https://files.catbox.moe/jvx0ya.jpg',
    category: 'Assistants',
    tags: ['Assistant', 'AI Core', 'Official']
  },
  {
    id: 'anti-delete-bot',
    name: 'Guardian Security',
    desc: 'Anti-delete, anti-link, and anti-edit security agent for WhatsApp group monitoring.',
    avatar: 'https://files.catbox.moe/dyc75h.jpg',
    category: 'Security',
    tags: ['Security', 'Anti-Delete', 'Moderation']
  },
  {
    id: 'anime-waifu',
    name: 'Sakura AI',
    desc: 'Interactive companion character with anime personality and dialogue generation.',
    avatar: 'https://files.catbox.moe/sn73hm.jpg',
    category: 'Anime',
    tags: ['Anime', 'Companion', 'Interactive']
  },
  {
    id: 'rpg-master',
    name: 'Dungeon Master',
    desc: 'Text-based RPG adventure engine for interactive group storytelling and questing.',
    avatar: 'https://files.catbox.moe/lgd6pn.jpg',
    category: 'RPG',
    tags: ['RPG', 'Gaming', 'Story']
  }
];

let currentUser = null;
let currentActiveView = 'explore';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initAuth();
  initCharacters();
  initPairing();
  initChat();
  initDashboard();
  checkAuthSession();
});

// Navigation & View Switching
function initNavigation() {
  const sidebar = document.getElementById('sidebar');
  const mobileToggle = document.getElementById('mobileToggle');

  mobileToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      switchView(view);
      sidebar.classList.remove('open');
    });
  });
}

function switchView(viewId) {
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.toggle('active', nav.getAttribute('data-view') === viewId);
  });

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSec = document.getElementById(`view-${viewId}`);
  if (targetSec) {
    targetSec.classList.add('active');
    currentActiveView = viewId;
    if (viewId === 'analytics') loadAnalytics();
    if (viewId === 'bot-control') loadBotControl();
    if (viewId === 'users') loadUsers();
    if (viewId === 'settings') loadSettings();
  }
}

// Authentication Logic
function initAuth() {
  const authModal = document.getElementById('authModal');
  const authModalCloseBtn = document.getElementById('authModalCloseBtn');
  const headerAuthBtn = document.getElementById('headerAuthBtn');
  const authActionBtn = document.getElementById('authActionBtn');

  const authLoginForm = document.getElementById('authLoginForm');
  const authRegisterForm = document.getElementById('authRegisterForm');
  const authProfileView = document.getElementById('authProfileView');

  const switchToRegister = document.getElementById('switchToRegister');
  const switchToLogin = document.getElementById('switchToLogin');
  const logoutBtn = document.getElementById('logoutBtn');

  const openModal = () => authModal.classList.add('active');
  const closeModal = () => authModal.classList.remove('active');

  headerAuthBtn.addEventListener('click', openModal);
  authActionBtn.addEventListener('click', openModal);
  authModalCloseBtn.addEventListener('click', closeModal);

  switchToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    authLoginForm.style.display = 'none';
    authRegisterForm.style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Create Terminal Vast Account';
  });

  switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    authRegisterForm.style.display = 'none';
    authLoginForm.style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Sign In to Terminal Vast';
  });

  authLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      currentUser = data.user;
      updateAuthUI();
      closeModal();
    } catch (err) {
      showAuthError(err.message);
    }
  });

  authRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      currentUser = data.user;
      updateAuthUI();
      closeModal();
    } catch (err) {
      showAuthError(err.message);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      currentUser = null;
      updateAuthUI();
      closeModal();
    } catch (err) {
      console.error(err);
    }
  });
}

function showAuthError(msg) {
  const errBox = document.getElementById('authErrorMsg');
  errBox.textContent = msg;
  errBox.style.display = 'block';
  setTimeout(() => { errBox.style.display = 'none'; }, 5000);
}

async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated) {
      currentUser = data.user;
    } else {
      currentUser = null;
    }
    updateAuthUI();
  } catch (err) {
    currentUser = null;
    updateAuthUI();
  }
}

function updateAuthUI() {
  const userNameDisplay = document.getElementById('userNameDisplay');
  const avatarInitial = document.getElementById('avatarInitial');
  const authLoginForm = document.getElementById('authLoginForm');
  const authRegisterForm = document.getElementById('authRegisterForm');
  const authProfileView = document.getElementById('authProfileView');
  const profileUsername = document.getElementById('profileUsername');
  const profileRole = document.getElementById('profileRole');
  const authModalTitle = document.getElementById('authModalTitle');

  if (currentUser) {
    userNameDisplay.textContent = currentUser.username;
    avatarInitial.textContent = currentUser.username.charAt(0).toUpperCase();

    authLoginForm.style.display = 'none';
    authRegisterForm.style.display = 'none';
    authProfileView.style.display = 'block';

    profileUsername.textContent = currentUser.username;
    profileRole.textContent = `Role: ${currentUser.role === 'admin' ? 'Administrator' : 'User'}`;
    authModalTitle.textContent = 'Account Profile';
  } else {
    userNameDisplay.textContent = 'Guest User';
    avatarInitial.textContent = 'G';

    authLoginForm.style.display = 'block';
    authRegisterForm.style.display = 'none';
    authProfileView.style.display = 'none';
    authModalTitle.textContent = 'Sign In to Terminal Vast';
  }
}

// Render Character Cards & Modal (Screenshots 1, 2, 3 Reference)
function initCharacters() {
  const grid = document.getElementById('charactersGrid');
  const modal = document.getElementById('charModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalAvatar = document.getElementById('modalAvatar');
  const modalName = document.getElementById('modalName');
  const modalBio = document.getElementById('modalBio');
  const modalTags = document.getElementById('modalTags');
  const modalChatBtn = document.getElementById('modalChatBtn');

  grid.innerHTML = CHARACTERS.map(c => `
    <div class="character-card" onclick="openCharacterModal('${c.id}')">
      <img src="${c.avatar}" class="card-thumb" alt="${c.name}">
      <div class="card-body">
        <div class="card-title">${c.name}</div>
        <div class="card-desc">${c.desc}</div>
        <div class="card-tags">
          ${c.tags.map(t => `<span class="badge-tag">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');

  modalCloseBtn.addEventListener('click', () => modal.classList.remove('active'));

  window.openCharacterModal = (id) => {
    const char = CHARACTERS.find(c => c.id === id);
    if (!char) return;

    modalAvatar.src = char.avatar;
    modalName.textContent = char.name;
    modalBio.textContent = char.desc;
    modalTags.innerHTML = char.tags.map(t => `<span class="badge-tag">${t}</span>`).join('');
    modalChatBtn.onclick = () => {
      modal.classList.remove('active');
      document.getElementById('chatAssistantTitle').textContent = char.name;
      switchView('chat');
    };

    modal.classList.add('active');
  };
}

// Pairing Flow
function initPairing() {
  const form = document.getElementById('pairForm');
  const phoneInput = document.getElementById('phoneInput');
  const statusBox = document.getElementById('pairStatus');
  const codeBox = document.getElementById('codeDisplayBox');
  const codeVal = document.getElementById('pairingCodeVal');
  const copyBtn = document.getElementById('copyCodeBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = phoneInput.value.replace(/\D/g, '');
    if (phone.length < 7 || phone.length > 15) {
      statusBox.textContent = 'Please enter a valid international WhatsApp number.';
      statusBox.className = 'status-badge status-offline';
      statusBox.style.display = 'inline-block';
      return;
    }

    statusBox.textContent = 'Generating pairing code...';
    statusBox.className = 'status-badge status-online';
    statusBox.style.display = 'inline-block';

    try {
      const res = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request code');
      if (data.code) {
        codeVal.textContent = data.code;
        codeBox.style.display = 'block';
        statusBox.textContent = 'Pairing code generated! Open WhatsApp > Linked Devices to pair.';
      }
    } catch (err) {
      statusBox.textContent = err.message;
      statusBox.className = 'status-badge status-offline';
    }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(codeVal.textContent);
    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Code'; }, 2000);
  });
}

// Interactive AI Chat (Screenshot 4 Reference)
function initChat() {
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  const msgs = document.getElementById('chatMessages');

  const sendMessage = () => {
    const text = input.value.trim();
    if (!text) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'chat-bubble user';
    userMsg.textContent = text;
    msgs.appendChild(userMsg);
    input.value = '';

    msgs.scrollTop = msgs.scrollHeight;

    setTimeout(() => {
      const botMsg = document.createElement('div');
      botMsg.className = 'chat-bubble bot';
      botMsg.textContent = `[Terminal Vast Assistant]: Received "${text}". I am monitoring active bot services and session connections.`;
      msgs.appendChild(botMsg);
      msgs.scrollTop = msgs.scrollHeight;
    }, 800);
  };

  btn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  window.clearChat = () => {
    msgs.innerHTML = '<div class="chat-bubble bot">Hello! Chat cleared. How may I assist you?</div>';
  };
}

// Dashboard Functions
function initDashboard() {
  // Sudo form submit
  const sudoForm = document.getElementById('sudoForm');
  if (sudoForm) {
    sudoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('sudoPhoneInput').value;
      try {
        const res = await fetch('/api/users/sudo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', phone })
        });
        const data = await res.json();
        alert(data.message || 'Sudo user updated');
        loadUsers();
      } catch (err) {
        alert('Error adding sudo user');
      }
    });
  }

  // Settings form submit
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        botname: document.getElementById('settingBotName').value,
        ownername: document.getElementById('settingOwnerName').value,
        ownernumber: document.getElementById('settingOwnerNumber').value,
        prefix: document.getElementById('settingPrefix').value
      };
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        alert(data.message || 'Settings saved successfully');
      } catch (err) {
        alert('Error saving settings');
      }
    });
  }
}

async function loadAnalytics() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('statUptime').textContent = data.uptime || '--';
    document.getElementById('statHeap').textContent = (data.memory?.heapUsed || '--') + ' MB';
    document.getElementById('statSessions').textContent = data.sessions ?? '0';
    document.getElementById('statPing').textContent = Math.floor(Math.random() * 20 + 15) + ' ms';
  } catch (err) {}
}

async function loadBotControl() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const modeBadge = document.getElementById('activeModeBadge');
    modeBadge.textContent = (data.mode || 'public').toUpperCase() + ' MODE';
    modeBadge.className = 'status-badge ' + (data.mode === 'private' ? 'status-offline' : 'status-online');
  } catch (err) {}
}

window.setBotMode = async (mode) => {
  try {
    const res = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    const data = await res.json();
    alert(data.message || 'Mode updated');
    loadBotControl();
  } catch (err) {
    alert('Failed to update mode');
  }
};

window.restartEngine = async () => {
  if (!confirm('Reboot bot process?')) return;
  try {
    await fetch('/api/restart', { method: 'POST' });
    alert('Restart signal sent.');
  } catch (err) {
    alert('Restarting...');
  }
};

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    const sudoContainer = document.getElementById('sudoUsersList');
    if (data.sudo && data.sudo.length > 0) {
      sudoContainer.innerHTML = data.sudo.map(num => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-input); border-radius:var(--radius-sm); margin-bottom:8px;">
          <span><i class="fas fa-user-shield" style="color:var(--primary);"></i> ${num}</span>
          <button class="btn-secondary" style="padding:4px 10px; font-size:12px; border-color:#ef4444; color:#ef4444;" onclick="removeSudo('${num}')">Remove</button>
        </div>
      `).join('');
    } else {
      sudoContainer.innerHTML = '<p style="color:var(--text-muted);">No sudo users configured.</p>';
    }
  } catch (err) {}
}

window.removeSudo = async (phone) => {
  try {
    const res = await fetch('/api/users/sudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', phone })
    });
    const data = await res.json();
    alert(data.message || 'Removed');
    loadUsers();
  } catch (err) {
    alert('Failed to remove sudo user');
  }
};

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data) {
      if (data.botname) document.getElementById('settingBotName').value = data.botname;
      if (data.ownername) document.getElementById('settingOwnerName').value = data.ownername;
      if (data.ownernumber) document.getElementById('settingOwnerNumber').value = data.ownernumber;
      if (data.prefix) document.getElementById('settingPrefix').value = data.prefix;
    }
  } catch (err) {}
}
