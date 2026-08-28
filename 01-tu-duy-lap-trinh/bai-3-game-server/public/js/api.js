// API client and session storage helpers
const API_BASE = '/api/v1';

function getToken() {
  return sessionStorage.getItem('game_jwt_token') || localStorage.getItem('game_jwt_token');
}

function setToken(token) {
  sessionStorage.setItem('game_jwt_token', token);
  localStorage.setItem('game_jwt_token', token);
}

function getUser() {
  const user = sessionStorage.getItem('game_user_info') || localStorage.getItem('game_user_info');
  return user ? JSON.parse(user) : null;
}

function setUser(user) {
  sessionStorage.setItem('game_user_info', JSON.stringify(user));
  localStorage.setItem('game_user_info', JSON.stringify(user));
}

function removeToken() {
  sessionStorage.removeItem('game_jwt_token');
  sessionStorage.removeItem('game_user_info');
  localStorage.removeItem('game_jwt_token');
  localStorage.removeItem('game_user_info');
}

function logout() {
  removeToken();
  window.location.href = '/login.html';
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      removeToken();
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = '/login.html';
      }
    }
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || 'Đã có lỗi xảy ra';
    throw new Error(message);
  }

  return data;
}

function showToast(message, type = 'info') {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  const icon = type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : 'ℹ️ ';
  toast.innerText = icon + message;
  toast.style.display = 'block';

  if (type === 'error') {
    toast.style.borderColor = 'var(--accent-rose)';
  } else if (type === 'success') {
    toast.style.borderColor = 'var(--accent-emerald)';
  } else {
    toast.style.borderColor = 'var(--border-color)';
  }

  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}

function updateNavAuth() {
  const authNav = document.getElementById('nav-auth-container');
  if (!authNav) return;

  const user = getUser();
  if (user) {
    const displayName = user.nickname || user.username;
    authNav.innerHTML = `
      <a href="/profile.html" class="user-badge" title="Chỉnh sửa hồ sơ" style="text-decoration:none;color:inherit;">
        <div class="user-avatar">${displayName.charAt(0).toUpperCase()}</div>
        <span style="font-weight:600;font-size:0.9rem;">${displayName}</span>
      </a>
      <button onclick="logout()" class="btn btn-secondary" style="padding:0.4rem 0.8rem;font-size:0.85rem;">Đăng xuất</button>
    `;
  } else {
    authNav.innerHTML = `
      <a href="/login.html" class="btn btn-primary" style="padding:0.4rem 1rem;font-size:0.9rem;">Đăng nhập / Đăng ký</a>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
});
