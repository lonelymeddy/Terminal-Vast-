// ==========================================================================
// TERMINAL VAST BOT - FRONTEND APPLICATION LOGIC
// ==========================================================================

let currentUser = null;
let currentLang = 'ES';

document.addEventListener('DOMContentLoaded', () => {
  initMobileDrawer();
  initLanguageSelector();
  initThemeToggle();
  initAuthModal();
  initPairingFlow();
  initDashboardControls();
  checkAuthSession();
});

// Mobile Menu Drawer
function initMobileDrawer() {
  const toggleBtn = document.getElementById('mobileToggleBtn');
  const closeBtn = document.getElementById('mobileDrawerClose');
  const drawer = document.getElementById('mobileDrawer');

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => drawer.classList.add('open'));
  }
  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => drawer.classList.remove('open'));
  }

  document.querySelectorAll('.mobile-nav-item').forEach(link => {
    link.addEventListener('click', () => {
      if (drawer) drawer.classList.remove('open');
    });
  });
}

// Language Selector Dropdown
function initLanguageSelector() {
  const langBtn = document.getElementById('langSelectorBtn');
  const wrapper = langBtn?.closest('.dropdown-wrapper');

  if (langBtn && wrapper) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      wrapper.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      wrapper.classList.remove('open');
    });
  }
}

window.setLanguage = (lang) => {
  currentLang = lang;
  const label = document.getElementById('currentLangLabel');
  if (label) label.textContent = lang;

  document.querySelectorAll('.dropdown-item').forEach(item => {
    item.classList.toggle('active', item.textContent.includes(`(${lang})`));
  });
};

// Theme Toggle Button
function initThemeToggle() {
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const icon = themeBtn.querySelector('i');
      if (icon.classList.contains('fa-moon')) {
        icon.className = 'fas fa-sun';
      } else {
        icon.className = 'fas fa-moon';
      }
    });
  }
}

// Connection Tab Switcher (Pair Code vs QR Code)
window.switchConnectionTab = (tab) => {
  const tabPair = document.getElementById('tabPairCodeBtn');
  const tabQr = document.getElementById('tabQrCodeBtn');
  const panelPair = document.getElementById('panelPairCode');
  const panelQr = document.getElementById('panelQrCode');

  if (tab === 'pair') {
    tabPair.classList.add('active');
    tabQr.classList.remove('active');
    panelPair.style.display = 'block';
    panelQr.style.display = 'none';
  } else {
    tabQr.classList.add('active');
    tabPair.classList.remove('active');
    panelQr.style.display = 'block';
    panelPair.style.display = 'none';
  }
};

// WhatsApp Pairing Flow via Backend /api/pair
function initPairingFlow() {
  const form = document.getElementById('pairCodeForm');
  const phoneInput = document.getElementById('phoneInput');
  const statusBadge = document.getElementById('pairStatusBadge');
  const codeBox = document.getElementById('codeDisplayBox');
  const codeVal = document.getElementById('pairingCodeVal');
  const copyBtn = document.getElementById('copyCodeBtn');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = phoneInput.value.replace(/\D/g, '');

      if (phone.length < 7 || phone.length > 15) {
        showStatusBadge('Por favor ingresa un número telefónico internacional válido (ej. 256702662846).', 'error');
        return;
      }

      showStatusBadge('Generando código de vinculación con WhatsApp...', 'loading');
      codeBox.style.display = 'none';

      try {
        const res = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al generar el código.');

        if (data.code) {
          codeVal.textContent = data.code;
          codeBox.style.display = 'block';
          showStatusBadge('¡Código generado con éxito! Ingrésalo en WhatsApp.', 'loading');
        } else if (data.status === 'connected') {
          showStatusBadge('Esta sesión de WhatsApp ya se encuentra conectada.', 'loading');
        }
      } catch (err) {
        showStatusBadge(err.message, 'error');
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeVal.textContent);
      copyBtn.innerHTML = '<i class="fas fa-check"></i> ¡COPIADO!';
      setTimeout(() => {
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> COPIAR CÓDIGO';
      }, 2000);
    });
  }
}

function showStatusBadge(msg, type) {
  const badge = document.getElementById('pairStatusBadge');
  if (badge) {
    badge.textContent = msg;
    badge.className = `pair-status-badge ${type}`;
    badge.style.display = 'block';
  }
}

window.requestQrSession = () => {
  const container = document.getElementById('qrDisplayContainer');
  if (container) {
    container.innerHTML = `
      <div style="padding:20px;">
        <i class="fas fa-spinner fa-spin text-orange" style="font-size:36px; margin-bottom:12px;"></i>
        <p style="font-size:14px; font-weight:600;">Iniciando escáner QR de WhatsApp...</p>
        <span style="font-size:12px; color:var(--text-dim);">Utiliza la pestaña PAIR CODE para vinculación rápida de número.</span>
      </div>
    `;
  }
};

// Internal Offline Authentication Modal
function initAuthModal() {
  const modal = document.getElementById('authModal');
  const closeBtn = document.getElementById('authModalCloseBtn');
  const headerAuthBtn = document.getElementById('headerAuthBtn');
  const mobileAuthBtn = document.getElementById('mobileAuthBtn');

  const loginForm = document.getElementById('authLoginForm');
  const regForm = document.getElementById('authRegisterForm');
  const profileView = document.getElementById('authProfileView');

  const switchToRegister = document.getElementById('switchToRegister');
  const switchToLogin = document.getElementById('switchToLogin');
  const logoutBtn = document.getElementById('logoutBtn');
  const changePwForm = document.getElementById('changePasswordForm');

  window.openAuthModal = () => modal.classList.add('active');
  const closeModal = () => modal.classList.remove('active');

  if (headerAuthBtn) headerAuthBtn.addEventListener('click', openAuthModal);
  if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', openAuthModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (switchToRegister) {
    switchToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      regForm.style.display = 'flex';
      document.getElementById('authModalTitle').textContent = 'Crear Cuenta Terminal Vast';
    });
  }

  if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      regForm.style.display = 'none';
      loginForm.style.display = 'flex';
      document.getElementById('authModalTitle').textContent = 'Iniciar Sesión en Terminal Vast';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
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
        if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');

        currentUser = data.user;
        updateAuthUI();
        closeModal();
      } catch (err) {
        showAuthError(err.message);
      }
    });
  }

  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
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
        if (!res.ok) throw new Error(data.error || 'Error al registrarse');

        currentUser = data.user;
        updateAuthUI();
        closeModal();
      } catch (err) {
        showAuthError(err.message);
      }
    });
  }

  if (logoutBtn) {
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

  if (changePwForm) {
    changePwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPassword = document.getElementById('oldPassword').value;
      const newPassword = document.getElementById('newPassword').value;

      try {
        const res = await fetch('/api/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña');

        alert('¡Contraseña actualizada con éxito!');
        changePwForm.reset();
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

function showAuthError(msg) {
  const errAlert = document.getElementById('authErrorMsg');
  if (errAlert) {
    errAlert.textContent = msg;
    errAlert.style.display = 'block';
    setTimeout(() => { errAlert.style.display = 'none'; }, 5000);
  }
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
  } catch (_) {
    currentUser = null;
    updateAuthUI();
  }
}

function updateAuthUI() {
  const headerBtn = document.getElementById('headerAuthBtn');
  const loginForm = document.getElementById('authLoginForm');
  const regForm = document.getElementById('authRegisterForm');
  const profileView = document.getElementById('authProfileView');
  const profileUsername = document.getElementById('profileUsername');
  const profileRole = document.getElementById('profileRole');
  const profileAvatar = document.getElementById('profileAvatarInitial');
  const title = document.getElementById('authModalTitle');

  if (currentUser) {
    if (headerBtn) headerBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${currentUser.username.toUpperCase()}`;
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'none';
    if (profileView) profileView.style.display = 'block';

    if (profileUsername) profileUsername.textContent = currentUser.username;
    if (profileRole) profileRole.textContent = currentUser.role === 'admin' ? 'Administrador' : 'Usuario Registrado';
    if (profileAvatar) profileAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
    if (title) title.textContent = 'Perfil de Cuenta';
  } else {
    if (headerBtn) headerBtn.innerHTML = `<i class="fas fa-user-circle"></i> CUENTA`;
    if (loginForm) loginForm.style.display = 'flex';
    if (regForm) regForm.style.display = 'none';
    if (profileView) profileView.style.display = 'none';
    if (title) title.textContent = 'Iniciar Sesión en Terminal Vast';
  }
}

// Dashboard Panel Controls
function initDashboardControls() {
  const dashNavBtn = document.getElementById('navDashboardBtn');
  const mobileDashBtn = document.getElementById('mobileDashboardBtn');

  if (dashNavBtn) dashNavBtn.addEventListener('click', (e) => { e.preventDefault(); openDashboard(); });
  if (mobileDashBtn) mobileDashBtn.addEventListener('click', (e) => { e.preventDefault(); openDashboard(); });

  const sudoForm = document.getElementById('dashSudoForm');
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
        alert(data.message || 'Usuario Sudo actualizado');
        loadUsers();
      } catch (err) {
        alert('Error al añadir usuario sudo.');
      }
    });
  }

  const settingsForm = document.getElementById('dashSettingsForm');
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
        alert(data.message || 'Configuración guardada correctamente.');
      } catch (err) {
        alert('Error al guardar ajustes.');
      }
    });
  }
}

window.openDashboard = () => {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  const modal = document.getElementById('dashboardModal');
  if (modal) {
    modal.classList.add('active');
    loadBotControl();
  }
};

window.closeDashboard = () => {
  const modal = document.getElementById('dashboardModal');
  if (modal) modal.classList.remove('active');
};

window.switchDashTab = (tab) => {
  document.querySelectorAll('.dash-tab').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.dash-panel-content').forEach(p => p.style.display = 'none');

  if (tab === 'control') {
    document.querySelectorAll('.dash-tab')[0].classList.add('active');
    document.getElementById('dashPanelControl').style.display = 'block';
    loadBotControl();
  } else if (tab === 'analytics') {
    document.querySelectorAll('.dash-tab')[1].classList.add('active');
    document.getElementById('dashPanelAnalytics').style.display = 'block';
    loadAnalytics();
  } else if (tab === 'sudo') {
    document.querySelectorAll('.dash-tab')[2].classList.add('active');
    document.getElementById('dashPanelSudo').style.display = 'block';
    loadUsers();
  } else if (tab === 'settings') {
    document.querySelectorAll('.dash-tab')[3].classList.add('active');
    document.getElementById('dashPanelSettings').style.display = 'block';
    loadSettings();
  }
};

async function loadBotControl() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const modeBadge = document.getElementById('dashActiveMode');
    if (modeBadge) {
      modeBadge.textContent = (data.mode || 'public').toUpperCase();
    }
  } catch (_) {}
}

window.setBotMode = async (mode) => {
  try {
    const res = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    const data = await res.json();
    alert(data.message || 'Modo actualizado');
    loadBotControl();
  } catch (_) {
    alert('No se pudo actualizar el modo del bot.');
  }
};

window.restartEngine = async () => {
  if (!confirm('¿Deseas reiniciar el proceso de Terminal Vast Bot?')) return;
  try {
    await fetch('/api/restart', { method: 'POST' });
    alert('Se envió la señal de reinicio al servidor.');
  } catch (_) {
    alert('Reiniciando servidor...');
  }
};

async function loadAnalytics() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('dashUptime').textContent = data.uptime || '--';
    document.getElementById('dashRam').textContent = (data.memory?.heapUsed || '--') + ' MB';
    document.getElementById('dashSessions').textContent = data.sessions ?? '0';
  } catch (_) {}
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    const sudoContainer = document.getElementById('sudoUsersList');
    if (sudoContainer) {
      if (data.sudo && data.sudo.length > 0) {
        sudoContainer.innerHTML = data.sudo.map(num => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-input); border-radius:var(--radius-sm); margin-bottom:8px;">
            <span><i class="fas fa-user-shield text-orange"></i> ${num}</span>
            <button class="btn-danger" style="padding:4px 10px; font-size:11px;" onclick="removeSudo('${num}')">Eliminar</button>
          </div>
        `).join('');
      } else {
        sudoContainer.innerHTML = '<p class="text-dim text-sm">No hay usuarios sudo configurados.</p>';
      }
    }
  } catch (_) {}
}

window.removeSudo = async (phone) => {
  try {
    const res = await fetch('/api/users/sudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', phone })
    });
    const data = await res.json();
    alert(data.message || 'Usuario eliminado');
    loadUsers();
  } catch (_) {
    alert('Error al eliminar usuario sudo.');
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
  } catch (_) {}
}
