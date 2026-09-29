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

// 自定义主题字段 → 锁屏 CSS 变量（均为 lock.css 实际使用的变量）
const LOCK_THEME_VARS = {
  colorBgPrimary: '--color-bg-primary',
  colorBgSecondary: '--color-bg-secondary',
  colorBgTertiary: '--color-bg-tertiary',
  textColorPrimary: '--color-text-primary',
  textColorSecondary: '--color-text-secondary',
  textColorTertiary: '--color-text-tertiary',
  colorBorder: '--color-border',
  colorError: '--color-error',
};

// 跟随应用层主题（明暗 + 自定义配色）：锁屏是独立窗口，主题只能从主进程取
const applyAppTheme = () => {
  const theme = window.lockElectron.getTheme();
  if (!theme) return;

  document.body.classList.toggle('dark', !!theme.isDark);
  if (!theme.colors) return;

  // 必须落在 body 上：`.dark` 也是 body 的自定义属性来源，写在 html 上会被它盖掉
  const bodyStyle = document.body.style;
  Object.keys(LOCK_THEME_VARS).forEach((key) => {
    const value = theme.colors[key];
    if (value) bodyStyle.setProperty(LOCK_THEME_VARS[key], value);
  });
};

applyAppTheme();