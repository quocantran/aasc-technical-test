// Socket.IO Client Wrapper
function createGameSocket(namespace) {
  const token = getToken();
  if (!token) {
    showToast('Vui lòng đăng nhập để chơi trực tuyến', 'error');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1200);
    return null;
  }

  // Connect to namespace with JWT authentication
  const socket = io(namespace, {
    auth: {
      token: `Bearer ${token}`,
    },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log(`[Socket] Connected to ${namespace} (ID: ${socket.id})`);
  });

  socket.on('connect_error', (err) => {
    console.error(`[Socket] Connection error to ${namespace}:`, err.message);
    showToast(`Lỗi kết nối máy chủ: ${err.message}`, 'error');
    if (err.message.includes('auth') || err.message.includes('token')) {
      removeToken();
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1500);
    }
  });

  socket.on('error', (err) => {
    console.warn(`[Socket] Server error:`, err);
    showToast(err.message || 'Thao tác không thành công', 'error');
  });

  return socket;
}
