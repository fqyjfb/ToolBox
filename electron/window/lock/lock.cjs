const form = document.getElementById('unlockForm');
const passwordInput = document.getElementById('passwordInput');
const errorMsg = document.getElementById('errorMsg');
const closeBtn = document.getElementById('closeBtn');
const exitBtn = document.getElementById('exitBtn');
const titleBar = document.getElementById('titleBar');

let isDragging = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = passwordInput.value.trim();

  if (!password) {
    showError('请输入密码');
    return;
  }

  try {
    const isValid = await window.lockElectron.verifyPassword(password);
    if (isValid) {
      await window.lockElectron.unlock();
    } else {
      showError('密码错误，请重试');
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (error) {
    showError('验证失败，请重试');
    console.error('Unlock error:', error);
  }
});

closeBtn.addEventListener('click', () => {
  window.lockElectron.closeWindow();
});

exitBtn.addEventListener('click', () => {
  window.lockElectron.exitApp();
});

// 拖拽事件处理
titleBar.addEventListener('mousedown', (e) => {
  if (e.target === closeBtn || closeBtn.contains(e.target)) return;
  isDragging = true;
  window.lockElectron.dragStart();
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    window.lockElectron.dragMove();
  }
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    window.lockElectron.dragEnd();
  }
});

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
}

// 监听系统主题变化
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (prefersDark) {
  document.body.classList.add('dark');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (e.matches) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
});