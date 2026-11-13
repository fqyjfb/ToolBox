/* 悬浮球形象「桌面伙伴小橘」的交互逻辑
   眼神跟随 / 台词气泡 / 尾巴说话 / 拖拽表情 / 换装。
   装扮清单与 SVG 片段统一来自 pet-catalog.cjs，这里只负责注入与状态表达。 */

(function () {
  'use strict';

  var catalog = window.PetCatalog || null;
  // preload 未就绪时降级为纯展示形象，避免整页脚本中断
  var api = window.electronAPI || null;
  var ball = document.getElementById('floatBall');
  var pet = document.getElementById('floatPet');
  var bubble = document.getElementById('petBubble');
  var bubbleText = document.getElementById('petBubbleText') || bubble;
  var bubbleActions = document.getElementById('petBubbleActions');
  var svg = pet.querySelector('#petSvg');
  var eyes = pet.querySelector('#eyes');
  var mouth = pet.querySelector('.mouth-group');
  var tailEl = null;
  var pupils = eyes ? eyes.querySelectorAll('.pupil') : [];
  var slotHosts = {};

  if (catalog) {
    catalog.slots.forEach(function (slot) {
      slotHosts[slot.id] = pet.querySelector('[data-slot="' + slot.id + '"]');
    });
  }

  var EYE_RADIUS = 2.2;
  var TAIL_TALK_MS = 3000;
  var SAD_TICK_MS = 60;
  var SAD_THRESHOLD = 22;
  var BUBBLE_HOLD_MS = 4200;
  var IDLE_ANIM_DELAY_MS = 5000;
  var ENTER_POP_MS = 600;

  var eyeX = 0;
  var eyeY = 0;
  var dragging = false;
  var pendingFrame = false;
  var sadCount = 0;
  var sadTimer = null;
  var talkTimer = null;
  var bubbleTimer = null;
  var bubbleTtl = 0;
  var bubbleHasActions = false;
  var stateTimer = null;
  var idleTimer = null;
  var lastActivity = Date.now();
  var currentState = 'idle';

  // ── 眼神跟随鼠标 ──
  function render() {
    if (!eyes || !mouth) return;
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
    // 鼠标活动即视为非空闲（暂停态下也要能立刻恢复动画）
    touchActivity();
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
    tailEl.classList.add('talking');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(stopTailTalk, TAIL_TALK_MS);
  }

  function stopTailTalk() {
    if (!tailEl) return;
    tailEl.classList.remove('talking');
  }

  // ── 台词气泡 / 可交互卡片 ──
  function clearActions() {
    if (!bubbleActions) return;
    bubbleActions.innerHTML = '';
    bubbleActions.hidden = true;
    bubble.classList.remove('has-actions');
    // 无按钮时通知主进程可以恢复穿透（气泡本身可能还在显示，但按钮已清除）
    if (api && api.setInteractiveCard) {
      api.setInteractiveCard(false);
    }
  }

  function say(text) {
    if (!text) return;
    wakeAnimations();
    clearActions();
    bubbleText.textContent = text;
    startTailTalk();
    bubble.classList.add('show');
    scheduleBubbleHide(BUBBLE_HOLD_MS, false);
  }

  // 带按钮的卡片：actions = [{ label, action }]，action 交回主进程分发（卡片只负责展示）
  function showCard(card) {
    if (!card || !card.text) return;
    wakeAnimations();
    clearActions();
    bubbleText.textContent = card.text;
    var hasActions = false;
    if (bubbleActions && Array.isArray(card.actions) && card.actions.length > 0) {
      hasActions = true;
      // 最多渲染 3 个按钮（剪贴板提示为 翻译/总结/存笔记，店铺话术为 回复1~3），超出部分丢弃
      card.actions.slice(0, 3).forEach(function (item) {
        if (!item || !item.label) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pet-bubble-btn';
        btn.textContent = item.label;
        btn.addEventListener('click', function (event) {
          event.stopPropagation();
          if (item.action && api && api.floatAction) {
            api.floatAction(item.action);
          }
          clearBubble();
        });
        bubbleActions.appendChild(btn);
      });
      bubbleActions.hidden = false;
      bubble.classList.add('has-actions');
    }
    // 告诉主进程当前气泡是否有可点按钮 — 主进程据此保持窗口不穿透
    if (api && api.setInteractiveCard) {
      api.setInteractiveCard(hasActions);
    }
    startTailTalk();
    bubble.classList.add('show');
    scheduleBubbleHide(card.ttl || BUBBLE_HOLD_MS, hasActions);
  }

  function scheduleBubbleHide(ttl, hasActions) {
    bubbleTtl = ttl;
    bubbleHasActions = !!hasActions;
    unscheduleBubbleHide();
    bubbleTimer = setTimeout(function () {
      bubbleTimer = null;
      bubble.classList.remove('show');
      if (bubbleHasActions) clearActions();
    }, ttl);
  }

  function unscheduleBubbleHide() {
    if (bubbleTimer) {
      clearTimeout(bubbleTimer);
      bubbleTimer = null;
    }
  }

  function clearBubble() {
    unscheduleBubbleHide();
    bubble.classList.remove('show');
    clearActions();
  }

  // ── 状态机：单一 data-mood 驱动 CSS，到期自动回落 idle ──
  function setState(name, ttl) {
    clearTimeout(stateTimer);
    stateTimer = null;
    currentState = name || 'idle';
    ball.setAttribute('data-mood', currentState);
    if (ttl > 0) {
      stateTimer = setTimeout(function () { setState('idle'); }, ttl);
    }
    wakeAnimations();
  }

  // ── 空闲暂停循环动画：透明悬浮窗常驻合成的主要开销来自循环 animation，
  //    连续 5s 无交互且无状态/气泡/菜单/拖拽时暂停，任一交互或状态变化立即恢复 ──
  function isAnimBusy() {
    return dragging
      || currentState !== 'idle'
      || bubble.classList.contains('show')
      || ball.classList.contains('expanded');
  }

  function markAnimIdle(idle) {
    document.documentElement.classList.toggle('anim-idle', !!idle);
  }

  function touchActivity() {
    lastActivity = Date.now();
    markAnimIdle(false);
    // 已处于暂停态时没有在跑的检查定时器，交互唤醒后必须续订，否则不会再进入空闲
    if (!idleTimer) scheduleIdleCheck();
  }

  function scheduleIdleCheck() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      idleTimer = null;
      // 忙碌或刚有交互：保持播放并续订下一轮检查
      if (isAnimBusy() || Date.now() - lastActivity < IDLE_ANIM_DELAY_MS) {
        markAnimIdle(false);
        scheduleIdleCheck();
        return;
      }
      markAnimIdle(true);
    }, IDLE_ANIM_DELAY_MS);
  }

  // 状态切换/展开等入口统一唤醒：立即恢复动画并重新计时
  function wakeAnimations() {
    touchActivity();
    scheduleIdleCheck();
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
    wakeAnimations();
    if (!dragging) return;
    sadCount = 0;
    ball.classList.remove('drag-sad');
    clearBubble();
    if (!sadTimer) sadTimer = setInterval(tickSad, SAD_TICK_MS);
  }

  // ── 换装：按槽位注入装扮片段，缺少清单时保持默认静态形象 ──
  function applyOutfit(input, phrase) {
    if (!catalog) return;
    try {
      var outfit = catalog.normalizeOutfit(input);
      catalog.slots.forEach(function (slot) {
        var host = slotHosts[slot.id];
        if (!host) return;
        var item = catalog.getItem(outfit[slot.id]);
        host.innerHTML = item && item.svg ? item.svg : '';
      });
      pet.setAttribute('data-outfit', catalog.slots
        .map(function (slot) { return outfit[slot.id]; })
        .filter(Boolean)
        .join(' '));
      tailEl = pet.querySelector('#slot-tail .pet-tail');
    } catch (error) {
      console.warn('[float-pet] 装扮渲染失败，保留上一帧', error);
    }
    if (phrase) say(phrase);
  }

  function checkGeometry() {
    if (!catalog || !catalog.geometry || !svg) return;
    var geo = catalog.geometry;
    svg.setAttribute('viewBox', geo.viewBox);
    var box = pet.getBoundingClientRect();
    if (Math.round(box.width) !== geo.width || Math.round(box.height) !== geo.height) {
      console.warn('[float-pet] 形象尺寸与清单不一致', box.width, box.height, geo.width, geo.height);
    }
  }

  applyOutfit(catalog ? catalog.defaults : null);
  checkGeometry();
  render();
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  // 气泡悬浮期间暂停倒计时，离开后从原始 ttl 重新开始
  if (bubble) {
    bubble.addEventListener('mouseenter', unscheduleBubbleHide);
    bubble.addEventListener('mouseleave', function () {
      if (bubble.classList.contains('show') && bubbleTtl > 0) {
        scheduleBubbleHide(bubbleTtl, bubbleHasActions);
      }
    });
  }
  // 点击/滚轮同属交互：立即恢复被空闲暂停的动画（mousemove 在 handleMouseMove 内处理）
  document.addEventListener('mousedown', touchActivity, { passive: true });
  document.addEventListener('wheel', touchActivity, { passive: true });
  scheduleIdleCheck();

  if (api && api.getOutfit) {
    api.getOutfit().then(function (data) {
      applyOutfit(data && data.outfit);
    }).catch(function () {});
  }

  if (api && api.onOutfitChanged) {
    api.onOutfitChanged(function (data) {
      applyOutfit(data && data.outfit, data && data.phrase);
    });
  }

  requestAnimationFrame(function () {
    ball.classList.add('entering');
    // 入场欢迎语已由主进程「今日概览」启动卡取代（floatWindow.cjs 的 did-finish-load 钩子），
    // 这里只播弹出动画，结束后摘掉 .entering 回到常驻呼吸动画
    setTimeout(function () {
      ball.classList.remove('entering');
    }, ENTER_POP_MS);
  });

  if (api && api.onPetState) {
    api.onPetState(function (data) {
      setState((data && data.state) || 'idle', data && data.ttl);
    });
  }

  if (api && api.onPetCard) {
    api.onPetCard(function (card) {
      // 拖拽时优先保证跟手体验，卡片等下次事件再说
      if (dragging) return;
      showCard(card);
    });
  }

  window.FloatPet = {
    setDragging: setDragging,
    clearBubble: clearBubble,
    setState: setState,
    showCard: showCard,
    wakeAnimations: wakeAnimations
  };
})();
