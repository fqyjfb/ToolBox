const card = document.getElementById('lkCard');
const form = document.getElementById('unlockForm');
const passwordInput = document.getElementById('passwordInput');
const dotsContainer = document.getElementById('lkDots');
const submitBtn = document.getElementById('lkSubmit');
const errorEl = document.getElementById('lkError');
const closeBtn = document.getElementById('closeBtn');
const exitBtn = document.getElementById('exitBtn');
const titleBar = document.getElementById('titleBar');
const bodyEl = document.getElementById('lkBody');

// 状态机：idle ⇄ typing(经 input 事件) → verifying → { success | error → cooldown? → idle }
let state = 'idle';
let dotCount = 0;
let cooldownTimer = null;

const setState = (next) => {
  state = next;
  card.dataset.state = next;
};

const showError = (message) => {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
};

const hideError = () => {
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
};

// ---------------- 圆点输入反馈（增量渲染，避免整列重播弹入动画） ----------------

const syncDots = () => {
  const len = passwordInput.value.length;

  if (len > dotCount) {
    for (let i = dotCount; i < len; i++) {
      const dot = document.createElement('i');
      dot.className = 'lk-dot is-fill';
      dotsContainer.appendChild(dot);
      dotCount++;
    }
    return;
  }

  while (dotCount > len) {
    const last = dotsContainer.lastElementChild;
    if (!last) {
      dotCount = 0;
      break;
    }
    last.classList.add('is-out');
    dotCount--;
    setTimeout(() => last.remove(), 150);
  }
};

// 错误后圆点依次坠落（A5），duration 供外层衔接状态复位
const dropDots = () => {
  const dots = Array.from(dotsContainer.children);
  dots.forEach((dot, i) => {
    dot.classList.add('is-out');
    dot.style.animationDelay = `${i * 30}ms`;
  });
  const duration = 240 + dots.length * 30;
  setTimeout(() => {
    dotsContainer.innerHTML = '';
    dotCount = 0;
  }, duration);
  return duration;
};

passwordInput.addEventListener('input', syncDots);

// ---------------- 冷却（防暴力破解） ----------------

const formatCooldown = (seconds) => {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
};

const startCooldown = (seconds) => {
  setState('cooldown');
  passwordInput.disabled = true;
  submitBtn.disabled = true;

  let remaining = seconds;
  const render = () => showError(`尝试次数过多，请等待 ${formatCooldown(remaining)} 后重试`);
  render();

  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      render();
      return;
    }
    clearInterval(cooldownTimer);
    cooldownTimer = null;
    passwordInput.disabled = false;
    submitBtn.disabled = false;
    setState('idle');
    hideError();
    passwordInput.focus();
  }, 1000);
};

// ---------------- 提交与结果编排 ----------------

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // 验证中 / 冷却 / 错误抖动 / 成功动画期间一律不接受重复提交
  if (state !== 'idle') return;

  const password = passwordInput.value.trim();
  if (!password) {
    showError('请输入密码');
    return;
  }

  setState('verifying');

  try {
    const result = await window.lockElectron.verifyPassword(password);
    const isValid = result && typeof result === 'object'
      ? result.success === true
      : result === true;

    if (isValid) {
      hideError();
      setState('success');
      // 等锁扣弹开 + 边框光扫完再关窗，由主进程恢复主窗口/悬浮球
      setTimeout(() => {
        window.lockElectron.unlock();
      }, 600);
      return;
    }

    handleFailure(result);
  } catch (error) {
    console.error('Unlock error:', error);
    setState('idle');
    showError('验证失败，请重试');
    passwordInput.value = '';
    syncDots();
  }
});

const handleFailure = (result) => {
  const data = result && typeof result === 'object'
    ? result
    : { remainingAttempts: null, cooldownSeconds: 0 };
  const cooldownSeconds = data.cooldownSeconds || 0;

  setState('error');
  showError(
    cooldownSeconds > 0
      ? `尝试次数过多，请等待 ${formatCooldown(cooldownSeconds)} 后重试`
      : data.remainingAttempts != null
        ? `密码错误，还剩 ${data.remainingAttempts} 次尝试`
        : '密码错误，请重试'
  );

  // 抖动期间冻结输入（圆点保持红色展示），抖动结束后圆点坠落再复位
  passwordInput.value = '';
  passwordInput.readOnly = true;

  setTimeout(() => {
    const dropDuration = dropDots();
    setTimeout(() => {
      passwordInput.readOnly = false;
      if (cooldownSeconds > 0) {
        startCooldown(cooldownSeconds);
      } else {
        setState('idle');
        passwordInput.focus();
      }
    }, dropDuration);
  }, 420);
};

// ---------------- 焦点引导 ----------------

bodyEl.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  if (state === 'idle' && !passwordInput.disabled) passwordInput.focus();
});

window.addEventListener('focus', () => {
  if (state === 'idle' && !passwordInput.disabled) passwordInput.focus();
});

// ---------------- 标题栏按钮与拖拽 ----------------

closeBtn.addEventListener('click', () => {
  window.lockElectron.closeWindow();
});

exitBtn.addEventListener('click', () => {
  window.lockElectron.exitApp();
});

let isDragging = false;

titleBar.addEventListener('mousedown', (e) => {
  if (closeBtn.contains(e.target) || exitBtn.contains(e.target)) return;
  isDragging = true;
  window.lockElectron.dragStart();
});

document.addEventListener('mousemove', () => {
  if (isDragging) {
    window.lockElectron.dragMove();
  }
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
});

// ---------------- 底部时间 ----------------

const timeEl = document.getElementById('lkTime');
const dateEl = document.getElementById('lkDate');
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const pad = (n) => String(n).padStart(2, '0');

const renderClock = () => {
  const now = new Date();
  timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  dateEl.textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`;
};

renderClock();
setInterval(renderClock, 30 * 1000);

// ---------------- 主题与皮肤同步（独立窗口，只能从主进程取） ----------------

// 自定义主题字段 → 锁屏 CSS 变量（均为 lock.css 实际使用的变量）
const LOCK_THEME_VARS = {
  colorBgPrimary: '--color-bg-primary',
  colorBgSecondary: '--color-bg-secondary',
  colorBgTertiary: '--color-bg-tertiary',
  colorPrimary: '--lk-accent',
  textColorPrimary: '--color-text-primary',
  textColorSecondary: '--color-text-secondary',
  textColorTertiary: '--color-text-tertiary',
  colorBorder: '--color-border',
  colorError: '--color-error',
};

const SKINS = ['ink', 'aurora', 'theme'];

const applyAppTheme = () => {
  const theme = window.lockElectron.getTheme();
  if (!theme) return;

  document.body.classList.toggle('dark', !!theme.isDark);

  // 皮肤：不写死颜色，仅切换装饰层，配色全部来自主题令牌
  document.body.classList.remove(...SKINS.map((s) => `skin-${s}`));
  document.body.classList.add(`skin-${SKINS.includes(theme.skin) ? theme.skin : 'ink'}`);

  if (!theme.colors) return;

  // 必须落在 body 上：`.dark` 也是 body 的自定义属性来源，写在 html 上会被它盖掉
  const bodyStyle = document.body.style;
  Object.keys(LOCK_THEME_VARS).forEach((key) => {
    const value = theme.colors[key];
    if (value) bodyStyle.setProperty(LOCK_THEME_VARS[key], value);
  });
};

applyAppTheme();

// ---------------- 窗口重开时恢复进行中的冷却 ----------------

(async () => {
  try {
    const status = await window.lockElectron.getStatus();
    if (status && status.cooldownRemainingSeconds > 0) {
      startCooldown(status.cooldownRemainingSeconds);
    }
  } catch (error) {
    console.error('Failed to load lock status:', error);
  }
})();
