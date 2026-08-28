let isLoginMode = true;

function switchAuthTab(login) {
  isLoginMode = login;
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const btnSubmit = document.getElementById('btn-submit-auth');
  const authTitle = document.getElementById('auth-title');
  const authDesc = document.getElementById('auth-desc');

  if (isLoginMode) {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    btnSubmit.innerText = 'Đăng nhập';
    authTitle.innerText = 'Chào mừng trở lại';
    authDesc.innerText = 'Đăng nhập để tiếp tục chơi Line 98 và Cờ Caro online.';
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    btnSubmit.innerText = 'Tạo tài khoản';
    authTitle.innerText = 'Tham gia Cổng Game';
    authDesc.innerText = 'Tạo tài khoản để theo dõi điểm số và xếp hạng của bạn.';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');
  const btnSubmit = document.getElementById('btn-submit-auth');

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showToast('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu', 'error');
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerText = 'Đang xử lý...';

  try {
    if (isLoginMode) {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(data.accessToken);
      setUser(data.user);
      showToast(`Chào mừng bạn trở lại, ${data.user.nickname || data.user.username}!`, 'success');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
    } else {
      // Register
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      showToast('Đăng ký thành công! Đang tự động đăng nhập...', 'success');
      // Auto login
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(data.accessToken);
      setUser(data.user);
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerText = isLoginMode ? 'Đăng nhập' : 'Tạo tài khoản';
  }
}
