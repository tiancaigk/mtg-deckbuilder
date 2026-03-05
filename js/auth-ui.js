/**
 * MTG Deck Builder - 认证 UI 模块
 */

let currentUser = null;

// 打开认证弹窗
function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// 关闭认证弹窗
function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 切换认证标签
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-modal-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
  if (tab === 'login') {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
  } else {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
  }
}

// 处理登录
async function handleLogin() {
  let retries = 0;
  while (!window.mtgAuth && retries < 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }
  
  if (!window.mtgAuth) {
    const messageDiv = document.getElementById('loginMessage');
    if (messageDiv) {
      messageDiv.className = 'auth-message error';
      messageDiv.textContent = 'Supabase 未初始化，请刷新页面';
    }
    return;
  }
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const messageDiv = document.getElementById('loginMessage');
  
  if (!email || !password) {
    if (messageDiv) {
      messageDiv.className = 'auth-message error';
      messageDiv.textContent = '请输入邮箱和密码';
    }
    return;
  }
  
  const result = await window.mtgAuth.signIn(email, password);
  
  if (result.success) {
    if (messageDiv) {
      messageDiv.className = 'auth-message success';
      messageDiv.textContent = '登录成功！';
    }
    setTimeout(() => {
      closeAuthModal();
      if (messageDiv) messageDiv.textContent = '';
    }, 1000);
  } else {
    if (messageDiv) {
      messageDiv.className = 'auth-message error';
      messageDiv.textContent = result.error;
    }
  }
}

// 处理注册
async function handleSignup() {
  let retries = 0;
  while (!window.mtgAuth && retries < 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }
  
  if (!window.mtgAuth) {
    const messageDiv = document.getElementById('signupMessage');
    if (messageDiv) {
      messageDiv.className = 'auth-message error';
      messageDiv.textContent = 'Supabase 未初始化，请刷新页面';
    }
    return;
  }
  
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const messageDiv = document.getElementById('signupMessage');
  
  if (!email || !password) {
    if (messageDiv) {
      messageDiv.className = 'auth-message error';
      messageDiv.textContent = '请输入邮箱和密码';
    }
    return;
  }
  
  if (password.length < 6) {
    if (messageDiv) {
      messageDiv.className = 'auth-message error';
      messageDiv.textContent = '密码至少 6 位';
    }
    return;
  }
  
  const result = await window.mtgAuth.signUp(email, password);
  
  if (result.success) {
    if (messageDiv) {
      messageDiv.className = 'auth-message success';
      messageDiv.textContent = '注册成功！请检查邮箱验证（如需要）';
    }
    setTimeout(() => {
      closeAuthModal();
      if (messageDiv) messageDiv.textContent = '';
    }, 2000);
  } else {
    if (messageDiv) {
      messageDiv.className = 'auth-message error';
      messageDiv.textContent = result.error;
    }
  }
}

// 处理登出
async function handleLogout() {
  if (window.mtgAuth && confirm('确定要登出吗？')) {
    await window.mtgAuth.signOut();
    currentUser = null;
    updateAuthUI();
  }
}

// 更新认证 UI
function updateAuthUI() {
  const authContainer = document.querySelector('.auth-buttons');
  if (!authContainer) return;
  
  if (currentUser) {
    authContainer.innerHTML = `
      <div class="user-info">
        <span class="user-email">${currentUser.email}</span>
        <div class="sync-status synced" id="syncStatus">已同步</div>
      </div>
      <button class="auth-btn" onclick="window.mtgDeck.showDeckManager()">☁️ 云端卡组</button>
      <button class="auth-btn" onclick="handleLogout()">登出</button>
    `;
  } else {
    authContainer.innerHTML = `
      <button class="auth-btn" onclick="openAuthModal()">🔐 登录/注册</button>
    `;
  }
}

// 加载云端卡组
async function loadCloudDecks() {
  if (!currentUser || !window.mtgAuth) return;
  
  console.log('🔍 正在加载云端卡组...');
  const result = await window.mtgAuth.loadDecks();
  
  if (result.success && result.decks.length > 0) {
    console.log('✅ 云端卡组:', result.decks);
    const savedDecks = window.mtgDeck.getSavedDecks();
    
    result.decks.forEach(cloudDeck => {
      const name = cloudDeck.name;
      if (!savedDecks[name]) {
        savedDecks[name] = {
          name: cloudDeck.name,
          main: cloudDeck.main_deck || [],
          side: cloudDeck.sideboard || [],
          updatedAt: cloudDeck.updated_at,
          fromCloud: true,
          cloudId: cloudDeck.id
        };
      }
    });
    
    localStorage.setItem('mtg-saved-decks', JSON.stringify(savedDecks));
    if (window.mtgDeck.renderSavedDecks) {
      window.mtgDeck.renderSavedDecks();
    }
    showToast(`已同步 ${result.decks.length} 副云端卡组`, 'success');
  }
}

// 初始化认证
function init() {
  if (window.mtgAuth) {
    window.mtgAuth.onAuthStateChange((event, user) => {
      currentUser = user;
      updateAuthUI();
      
      if (user) {
        loadCloudDecks();
      }
    });
    
    window.mtgAuth.getCurrentUser().then(user => {
      currentUser = user;
      updateAuthUI();
    });
  }
  
  // 弹窗外部关闭
  const modalEl = document.getElementById('authModal');
  if (modalEl) {
    modalEl.addEventListener('click', (e) => {
      if (e.target.id === 'authModal') {
        closeAuthModal();
      }
    });
  }
  
  console.log('✅ Auth UI initialized');
}

// 导出到全局
window.mtgAuthUI = {
  openAuthModal,
  closeAuthModal,
  switchAuthTab,
  handleLogin,
  handleSignup,
  handleLogout,
  updateAuthUI,
  loadCloudDecks,
  init
};

console.log('✅ Auth UI module loaded');
