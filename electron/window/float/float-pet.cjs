/* 悬浮球形象「桌面伙伴小橘」的交互逻辑
   来源：doc/悬浮球.html（眼神跟随 / 台词气泡 / 尾巴说话 / 拖拽表情 / 换装）。
   装扮由主进程右键「切换形象」菜单下发，对应 .float-pet 的 data-fit。 */

(function () {
  'use strict';

  var ball = document.getElementById('floatBall');
  var pet = document.getElementById('floatPet');
  var bubble = document.getElementById('petBubble');
  var eyes = pet.querySelector('#eyes');
  var mouth = pet.querySelector('.mouth-group');
  var tailEl = pet.querySelector('.tail');
  var pupils = eyes.querySelectorAll('.pupil');

  // 装扮取值需与 floatWindow.cjs 的 FLOAT_APPEARANCE_LIST 保持一致
  var FIT_PHRASES = {
    '': '右键我可以换装哦～试试看！',
    'ears': '喵～摸摸耳朵会呼噜哦！',
    'hat': '这是施了魔法的帽子，帅不帅！',
    'scarf': '围巾是莓果味的，暖暖的～'
  };

  var DEFAULT_PHRASES = {
    welcome: '来啦来啦！等你好久啦～',
    greeting: {
      lateNight: '早点休息，烦恼交给我保管～',
      morning: '早安！今天也元气满满哦～',
      noon: '中午啦，吃饭了么？别饿着~',
      afternoon: '下午的时光真难熬，还好有你在！',
      evening: '晚上好，要安静地学习啦~',
      night: '快来逗我玩吧！我好无聊啊~'
    },
    idle: [
      '好无聊哦，你都不陪我玩~',
      '我是个摆件，不是AI哦',
      '从前有座山，山里有座小包子…',
      '我可爱吧！嘻嘻~',
      '悄悄告诉你，双击空白处我能回家哦',
      '盯——你在看什么好东西？',
      '好无聊…陪我玩嘛～',
      '咦？我的包子馅呢…',
      '今天运气是草莓味的！',
      '嘘…我在和鼠标聊天～',
      '施了魔法，bug都会消失！',
      '今天的风甜甜的呢～',
      '喝水了吗？别忘了哦～',
      '坐太久啦，起来动一动嘛～',
      '眼睛酸了吧？看看远处～',
      '你不理我，我就把你密码改了！',
      '别看我圆，我这叫富态，懂？',
      '今天运势：宜摸头，忌不理包子。',
      '再不捏我，我就要自捏了！',
      '你的鼠标抖了诶，是心动了吧？',
      '你是不是在假装工作？',
      '摸鱼吗？我放哨，我嘴严得很。'
    ]
  };

  var EYE_RADIUS = 2.2;
  var TAIL_TALK_MS = 3000;
  var SAD_TICK_MS = 60;
  var SAD_THRESHOLD = 22;
  var BUBBLE_HOLD_MS = 4200;
  var IDLE_POLL_MS = 1000;
  var IDLE_FIRST_DELAY_MS = 5500;
  var IDLE_INTERVAL_MS = 45000;
  var ENTER_POP_MS = 600;

  var eyeX = 0;
  var eyeY = 0;
  var dragging = false;
  var pendingFrame = false;
  var sadCount = 0;
  var sadTimer = null;
  var talkTimer = null;
  var talkUntil = 0;
  var bubbleTimer = null;
  var lastSay = 0;

  // ── 眼神跟随鼠标 ──
  function render() {
    for (var i = 0; i < pupils.length; i++) {
      pupils[i].setAttribute('transform', 'translate(' + eyeX.toFixed(2) + ',' + eyeY.toFixed(2) + ')');
    }
    eyes.setAttribute('transform', 'translate(' + (eyeX * 0.4).toFixed(2) + ',' + (eyeY * 0.4).toFixed(2) + ')');
    mouth.setAttribute('transform', 'translate(' + (eyeX * 0.35).toFixed(2) + ',' + (eyeY * 0.35).toFixed(2) + ')');
  }

  function updateEyes(mx, my) {
    // 拖拽时窗口每帧移动，客户端坐标持续变化，此时跳过眼神计算（含 getBoundingClientRect
    // 与 SVG 属性写入），避免和窗口移动叠加导致掉帧
    if (dragging) return;
    var rect = pet.getBoundingClientRect();
    var dx = mx - (rect.left + rect.width / 2);
    var dy = my - (rect.top + rect.height / 2);
    var factor = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 90);
    var angle = Math.atan2(dy, dx);
    var targetX = Math.cos(angle) * EYE_RADIUS * factor;
    var targetY = Math.sin(angle) * EYE_RADIUS * factor;
    eyeX += (targetX - eyeX) * 0.25;
    eyeY += (targetY - eyeY) * 0.25;
    render();
  }

  function handleMouseMove(e) {
    if (pendingFrame) return;
    pendingFrame = true;
    var mx = e.clientX;
    var my = e.clientY;
    requestAnimationFrame(function () {
      pendingFrame = false;
      updateEyes(mx, my);
    });
  }

  // ── 尾巴说话 ──
  function startTailTalk() {
    if (!tailEl) return;
    // 时间戳守卫，避免多次说话时定时器相互竞态
    talkUntil = Date.now() + TAIL_TALK_MS;
    tailEl.classList.add('talking');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(stopTailTalk, TAIL_TALK_MS);
  }

  function stopTailTalk() {
    if (!tailEl) return;
    talkUntil = 0;
    // 移除后由 CSS 自动回落到 tailWag
    tailEl.classList.remove('talking');
  }

  // ── 台词气泡 ──
  function say(text) {
    if (!text) return;
    bubble.textContent = text;
    startTailTalk();
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubble.classList.remove('show');
    }, BUBBLE_HOLD_MS);
  }

  function clearBubble() {
    clearTimeout(bubbleTimer);
    bubble.classList.remove('show');
  }

  function hourPhase() {
    var h = new Date().getHours();
    if (h >= 0 && h < 5) return 'lateNight';
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 13) return 'noon';
    if (h >= 13 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }

  // ── 拖拽状态：举手惊讶，拖久了难过 ──
  function tickSad() {
    if (dragging) {
      sadCount++;
      ball.classList.toggle('drag-sad', sadCount > SAD_THRESHOLD);
      return;
    }
    if (sadCount > 0) {
      sadCount = Math.max(0, sadCount - 2);
      if (sadCount === 0) ball.classList.remove('drag-sad');
    }
    // 松手且情绪恢复完毕后停下轮询
    if (sadCount === 0) {
      clearInterval(sadTimer);
      sadTimer = null;
    }
  }

  function setDragging(next) {
    dragging = next;
    if (!dragging) return;
    sadCount = 0;
    ball.classList.remove('drag-sad');
    clearBubble();
    if (!sadTimer) sadTimer = setInterval(tickSad, SAD_TICK_MS);
  }

  // ── 换装 ──
  function normalizeFit(name) {
    return Object.prototype.hasOwnProperty.call(FIT_PHRASES, name) ? name : '';
  }

  function applyFit(name) {
    var fit = normalizeFit(name);
    pet.setAttribute('data-fit', fit === '' ? 'none' : fit);
  }

  // ── 空闲闲聊 ──
  function tickIdle() {
    // 兜底：页面隐藏 / 定时器竞态时强制归位
    if (talkUntil && Date.now() > talkUntil) stopTailTalk();
    if (dragging || ball.classList.contains('expanded')) return;
    var now = Date.now();
    if (lastSay === 0) {
      lastSay = now + IDLE_FIRST_DELAY_MS;
      return;
    }
    if (now - lastSay < IDLE_INTERVAL_MS) return;
    lastSay = now;
    var list = DEFAULT_PHRASES.idle;
    say(list[Math.floor(Math.random() * list.length)]);
  }

  render();
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  setInterval(tickIdle, IDLE_POLL_MS);

  if (window.electronAPI.getAppearance) {
    window.electronAPI.getAppearance().then(function (data) {
      applyFit((data && data.name) || '');
    }).catch(function () {});
  }

  if (window.electronAPI.onAppearanceChanged) {
    window.electronAPI.onAppearanceChanged(function (data) {
      var name = normalizeFit((data && data.name) || '');
      applyFit(name);
      say(FIT_PHRASES[name]);
    });
  }

  requestAnimationFrame(function () {
    ball.classList.add('entering');
    say(DEFAULT_PHRASES.welcome);
    setTimeout(function () {
      say(DEFAULT_PHRASES.greeting[hourPhase()]);
    }, 3200);
    // 弹出动画结束后摘掉 .entering，让 .body-scale 回到常驻呼吸动画
    setTimeout(function () {
      ball.classList.remove('entering');
    }, ENTER_POP_MS);
  });

  window.FloatPet = {
    setDragging: setDragging,
    clearBubble: clearBubble
  };
})();
