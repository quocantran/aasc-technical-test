document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  await loadProfile();
});

async function loadProfile() {
  try {
    const profile = await apiFetch('/auth/profile');
    document.getElementById('profile-username').value = profile.username;
    document.getElementById('profile-nickname').value = profile.nickname || '';
    document.getElementById('profile-email').value = profile.email || '';
    
    // Update stored user
    setUser({
      userId: profile.userId,
      username: profile.username,
      nickname: profile.nickname,
      email: profile.email,
    });
    updateNavAuth();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const nickname = document.getElementById('profile-nickname').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const btn = document.getElementById('btn-save-profile');

  btn.disabled = true;
  btn.innerText = 'Đang lưu...';

  try {
    const updated = await apiFetch('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ nickname, email }),
    });

    setUser({
      userId: updated.userId,
      username: updated.username,
      nickname: updated.nickname,
      email: updated.email,
    });
    updateNavAuth();
    showToast('Cập nhật thông tin thành công!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Lưu thay đổi';
  }
}
