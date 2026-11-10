/* 悬浮球 AI 面板：对话 / 划词四键 / 结果操作条
   设计约束：无构建步骤（与 float.html 同构），因此只用原生 DOM 与最小 Markdown 渲染。 */
(function () {
  'use strict';

  var api = window.panelAPI;
  var els = {
    messages: document.getElementById('messages'),
    input: document.getElementById('input'),
    sendBtn: document.getElementById('sendBtn'),
    closeBtn: document.getElementById('closeBtn'),
    historyBtn: document.getElementById('historyBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    headerMenuBtn: document.getElementById('headerMenuBtn'),
    headerDropdown: document.getElementById('headerDropdown'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    guide: document.getElementById('guide'),
    selectionBar: document.getElementById('selectionBar'),
    selectionText: document.getElementById('selectionText'),
    selectionActions: document.getElementById('selectionActions'),
    chatPresets: document.getElementById('chatPresets'),
    modelBadge: document.getElementById('modelBadge'),
    composer: document.getElementById('composer'),
    featurePanel: document.getElementById('featurePanel')
  };

  var MAX_HISTORY = 12;
  var session = { mode: 'chat', text: '' };
  var status = { configured: false, modelName: '' };
  var history = [];
  var sessionId = null;        // 对话历史会话 id：首次发送时生成，新对话/切模式时重置
  var sessionCreatedAt = 0;
  var streaming = null;
  var lastAssistantText = '';

  // 与 lock.cjs 同一套做法：面板读不到渲染层 localStorage，自定义配色由主进程下发快照，
  // 这里只覆盖 panel.css 实际用到的变量，未覆盖的继续走明暗基线
  var PANEL_THEME_VARS = {
    colorBgPrimary: '--color-bg-primary',
    colorBgSecondary: '--color-bg-secondary',
    colorBgTertiary: '--color-bg-tertiary',
    colorCard: '--color-card',
    colorMenuHover: '--color-menu-hover',
    colorBorder: '--color-border',
    textColorPrimary: '--color-text-primary',
    textColorSecondary: '--color-text-secondary',
    textColorTertiary: '--color-text-tertiary',
    colorPrimary: '--color-primary',
    colorPrimaryHover: '--color-primary-hover',
    colorSecondary: '--color-secondary',
    colorError: '--color-error'
  };

  function applyTheme(theme) {
    if (!theme) return;
    // 与 theme.css 一致：明暗基线挂在 html.dark 上；自定义配色按 lock.cjs 的做法写在 body
    document.documentElement.classList.toggle('dark', !!theme.isDark);
    document.body.classList.toggle('dark', !!theme.isDark);

    var style = document.body.style;
    Object.keys(PANEL_THEME_VARS).forEach(function (key) {
      style.removeProperty(PANEL_THEME_VARS[key]);
    });
    style.removeProperty('--color-button-text');

    var colors = theme.colors;
    if (!colors) return;
    Object.keys(PANEL_THEME_VARS).forEach(function (key) {
      var value = colors[key];
      if (value) style.setProperty(PANEL_THEME_VARS[key], value);
    });
    // 主按钮文字取原始主背景色，与 theme.css 自定义覆盖层同口径
    if (colors.colorBgPrimary) style.setProperty('--color-button-text', colors.colorBgPrimary);
  }

  // ── 文本渲染：先转义再上最小格式，避免模型输出 HTML 被执行 ──
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatInline(text) {
    return escapeHtml(text).replace(/`([^`\n]+)`/g, '<span class="code">$1</span>');
  }

  function scrollToBottom() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function appendUser(text) {
    var el = document.createElement('div');
    el.className = 'msg user';
    el.textContent = text;
    els.messages.appendChild(el);
    scrollToBottom();
  }

  function appendNotice(text) {
    var el = document.createElement('div');
    el.className = 'thinking';
    el.textContent = text;
    els.messages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function appendAssistant() {
    var el = document.createElement('div');
    el.className = 'msg assistant';
    var body = document.createElement('div');
    body.textContent = '…';
    el.appendChild(body);
    els.messages.appendChild(el);
    scrollToBottom();
    return { root: el, body: body };
  }

  function appendError(text) {
    var el = document.createElement('div');
    el.className = 'msg-error';
    el.textContent = text;
    els.messages.appendChild(el);
    scrollToBottom();
  }

  // ── 发送/停止 ──
  function setBusy(busy) {
    els.sendBtn.classList.toggle('stopping', !!busy);
    els.sendBtn.setAttribute('title', busy ? '停止' : '发送');
    els.sendBtn.setAttribute('aria-label', busy ? '停止' : '发送');
  }

  function autoGrow() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 96) + 'px';
  }

  function newRequestId() {
    return 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  // 划词/剪贴板/截图等预设共用的请求入口：不依赖输入框，便于任何模式直接发起
  function startPreset(preset, text) {
    if (streaming || !status.configured) {
      if (!status.configured) showGuide();
      return;
    }
    var content = String(text || '').trim();
    if (!content) return;
    var requestId = newRequestId();
    var bubble = appendAssistant();
    streaming = { requestId: requestId, body: bubble.body, root: bubble.root, text: '', thinkingEl: null, thinkingBody: null };
    lastAssistantText = '';
    setBusy(true);
    // 用户气泡里完整展示输入内容，不再只截 80 字，避免「发送的内容不完整」的错觉
    appendUser('[' + labelOf(preset) + '] ' + content);
    ensureSessionId();
    history.push({ role: 'user', content: content, label: labelOf(preset) });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    api.chatStream({ requestId: requestId, preset: preset, text: content });
  }

  function send(preset, textOverride) {
    if (streaming) return;
    var text = (typeof textOverride === 'string' ? textOverride : els.input.value).trim();
    if (!text) {
      els.input.focus();
      return;
    }
    if (!status.configured) {
      showGuide();
      return;
    }
    if (preset !== 'chat') {
      startPreset(preset, text);
    } else {
      var requestId = newRequestId();
      var bubble = appendAssistant();
      streaming = { requestId: requestId, body: bubble.body, root: bubble.root, text: '', thinkingEl: null, thinkingBody: null };
      lastAssistantText = '';
      setBusy(true);
      appendUser(text);
      ensureSessionId();
      history.push({ role: 'user', content: text });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      api.chatStream({ requestId: requestId, preset: 'chat', messages: contextMessages() });
    }

    if (typeof textOverride !== 'string') {
      els.input.value = '';
      autoGrow();
    }
  }

  function labelOf(preset) {
    return { translate: '翻译', polish: '润色', summarize: '总结', explain: '解释' }[preset] || preset;
  }

  function stopStreaming() {
    if (!streaming) return;
    api.cancel(streaming.requestId);
    streaming = null;
    setBusy(false);
    saveCurrentHistory();
  }

  // ── 结果操作条 ──
  function addActions(root, content) {
    var bar = document.createElement('div');
    bar.className = 'msg-actions';

    var copyBtn = document.createElement('button');
    copyBtn.textContent = '复制';
    copyBtn.onclick = function () { copyText(content); copyBtn.textContent = '已复制'; };

    var noteBtn = document.createElement('button');
    noteBtn.textContent = '存为笔记';
    noteBtn.onclick = function () { saveNote(content, noteBtn); };

    var todoBtn = document.createElement('button');
    todoBtn.textContent = '存为待办';
    todoBtn.onclick = function () { saveTodo(content, todoBtn); };

    var followBtn = document.createElement('button');
    followBtn.textContent = '继续追问';
    followBtn.onclick = function () { els.input.focus(); };

    bar.appendChild(copyBtn);
    bar.appendChild(noteBtn);
    bar.appendChild(todoBtn);
    bar.appendChild(followBtn);
    root.appendChild(bar);
    scrollToBottom();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var helper = document.createElement('textarea');
    helper.value = text;
    document.body.appendChild(helper);
    helper.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略：复制失败不阻塞交互 */ }
    document.body.removeChild(helper);
  }

  // 保存成功后跳转：主窗口前置并进入对应模块，面板随之隐藏
  function openSaved(kind, target, btn) {
    var action = kind === 'note' ? api.openNote(target) : api.openTodo(target);
    action.then(function (res) {
      if (!res || !res.ok) btn.textContent = (res && res.error) || '打开失败';
    }).catch(function () { btn.textContent = '打开失败'; });
  }

  function saveNote(content, btn) {
    btn.onclick = null; // 防重入
    btn.textContent = '保存中…';
    api.saveNote({ content: content }).then(function (result) {
      if (result && result.ok) {
        btn.textContent = '打开笔记';
        btn.title = result.path || ''; // 悬停可见保存位置，便于核对
        btn.onclick = function () { openSaved('note', result.path, btn); };
      } else {
        btn.textContent = (result && result.error) || '保存失败';
        btn.onclick = function () { saveNote(content, btn); };
      }
    }).catch(function () {
      btn.textContent = '保存失败';
      btn.onclick = function () { saveNote(content, btn); };
    });
  }

  function saveTodo(content, btn) {
    var title = content.split('\n')[0].replace(/^[#*\s]+/, '').slice(0, 60) || content.slice(0, 60);
    btn.onclick = null; // 防重入
    btn.textContent = '保存中…';
    api.saveTodo({ title: title, content: content }).then(function (result) {
      if (result && result.ok) {
        var todoId = result.todo && result.todo.id;
        btn.textContent = '查看待办';
        btn.title = '已保存到待办事项';
        btn.onclick = function () { openSaved('todo', todoId, btn); };
      } else {
        btn.textContent = (result && result.error) || '保存失败';
        btn.onclick = function () { saveTodo(content, btn); };
      }
    }).catch(function () {
      btn.textContent = '保存失败';
      btn.onclick = function () { saveTodo(content, btn); };
    });
  }

  // 输入框上方筹码的快捷保存：复用结果操作条的两套保存逻辑，不重复实现
  function bindQuickSave(btn) {
    btn.onclick = function () { quickSave(btn); };
  }

  function resetQuickSaveButtons() {
    els.chatPresets.querySelectorAll('[data-action]').forEach(function (btn) {
      var label = btn.dataset.action === 'save-note' ? '存笔记' : '存待办';
      if (btn.textContent === label) return;
      btn.textContent = label;
      btn.title = '';
      bindQuickSave(btn); // 「打开笔记 / 查看待办 / 保存失败」都恢复成保存入口
    });
  }

  function quickSave(btn) {
    var text = els.input.value.trim();
    if (!text) {
      els.input.focus();
      return;
    }
    if (btn.dataset.action === 'save-note') saveNote(text, btn);
    else saveTodo(text, btn);
  }

  // ── 未配置模型引导 ──
  function showGuide() {
    els.guide.hidden = false;
  }

  // ── 会话渲染 ──
  function clearMessages() {
    els.messages.innerHTML = '';
    lastAssistantText = '';
  }

  // ── 进阶模式（P1/P2）：共用一个容器，按 mode 渲染，避免每个模式一套静态 DOM ──
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function featureBlock(titleText, hintText) {
    els.featurePanel.innerHTML = '';
    var box = el('div', 'feature-block');
    // flex:1 撑满 feature-panel，内部再分标题/提示/列表三个区域
    box.style.cssText = 'flex:1 1 auto; min-height:0; display:flex; flex-direction:column;';
    box.appendChild(el('div', 'feature-title', titleText));
    if (hintText) box.appendChild(el('p', 'feature-hint', hintText));
    els.featurePanel.appendChild(box);
    return box;
  }

  function renderPalette() {
    var box = featureBlock('命令面板', '搜索工具与动作；↑↓ 选择、Enter 执行、Esc 关闭');
    var input = el('input', 'feature-input');
    input.type = 'text';
    input.placeholder = '输入关键词…';
    var inputWrap = el('div', 'feature-input-wrapper');
    inputWrap.appendChild(input);
    var list = el('div', 'palette-list');
    list.style.marginTop = '8px';
    box.appendChild(inputWrap);
    box.appendChild(list);
    var results = [];
    var selected = 0;

    function execute(item) {
      api.searchExec({ id: item.id, action: item.action });
      api.close();
    }
    function draw() {
      list.innerHTML = '';
      if (results.length === 0) {
        list.appendChild(el('p', 'feature-hint', '没有匹配结果'));
        return;
      }
      results.forEach(function (item, index) {
        var row = el('button', 'feature-row' + (index === selected ? ' active' : ''));
        row.type = 'button';
        row.appendChild(el('span', 'name', item.label));
        row.appendChild(el('span', 'group', item.group));
        row.onclick = function () { execute(item); };
        list.appendChild(row);
      });
    }
    function refresh() {
      api.search(input.value || '')
        .then(function (rows) { results = Array.isArray(rows) ? rows : []; selected = 0; draw(); })
        .catch(function () { results = []; draw(); });
    }
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (results.length > 0) {
          selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
          draw();
        }
      } else if (event.key === 'Enter' && results[selected]) {
        event.preventDefault();
        execute(results[selected]);
      } else if (event.key === 'Escape') {
        api.close();
      }
    });
    refresh();
    setTimeout(function () { input.focus(); }, 0);
  }

  function renderCapture() {
    var box = featureBlock('快速捕捉', '一句话记待办 / 笔记；识别后需要你确认才会写入');
    var input = el('textarea', 'feature-textarea');
    input.placeholder = '例如：明天 10 点和 A 供应商对账';
    // 外层单边框容器，与 chat composer .input-wrapper 同口径
    var inputWrap = el('div', 'feature-input-wrapper');
    inputWrap.appendChild(input);
    var actions = el('div', 'feature-actions');
    var go = el('button', 'primary', '识别');
    go.disabled = !status.configured;
    if (!status.configured) go.title = '请先在「设置 → AI 设置」里配置模型';
    var cancel = el('button', '', '取消');
    cancel.onclick = function () { api.close(); };
    actions.appendChild(go);
    actions.appendChild(cancel);
    var preview = el('div', 'feature-preview');
    preview.hidden = true;
    box.appendChild(inputWrap);
    box.appendChild(actions);
    box.appendChild(preview);

    go.onclick = function () {
      if (!status.configured) {
        preview.hidden = false;
        preview.textContent = '还没有配置 AI 模型，请先去「设置 → AI 设置」添加';
        var bar = el('div', 'feature-actions');
        var setupBtn = el('button', 'primary', '去设置');
        setupBtn.onclick = function () { api.openSettings(); };
        bar.appendChild(setupBtn);
        preview.appendChild(bar);
        return;
      }
      var text = input.value.trim();
      if (!text) return;
      go.textContent = '识别中…';
      go.disabled = true;
      preview.hidden = true;
      api.captureClassify(text).then(function (result) {
        go.textContent = '识别';
        go.disabled = false;
        preview.hidden = false;
        preview.innerHTML = '';
        if (!result || !result.ok) {
          preview.textContent = (result && result.error) || '识别失败';
          return;
        }
        var draft = result.draft;
        preview.appendChild(el('div', '', '将创建：' + (draft.kind === 'note' ? '笔记' : '待办') + ' · ' + draft.title));
        if (draft.time) preview.appendChild(el('div', '', '时间：' + draft.time));
        if (result.fallback) preview.appendChild(el('div', '', '没太听懂，先按笔记保存'));
        var bar = el('div', 'feature-actions');
        var confirmBtn = el('button', 'primary', '确认写入');
        confirmBtn.onclick = function () {
          api.captureCommit({ draft: draft, text: text }).then(function (res) {
            preview.textContent = res && res.ok ? '已写入，小橘帮你记下啦～' : ((res && res.error) || '写入失败');
          });
        };
        var abortBtn = el('button', '', '取消');
        abortBtn.onclick = function () { preview.hidden = true; };
        bar.appendChild(confirmBtn);
        bar.appendChild(abortBtn);
        preview.appendChild(bar);
      }).catch(function (error) {
        go.textContent = '识别';
        go.disabled = !status.configured;
        preview.hidden = false;
        preview.textContent = String((error && error.message) || error || '识别失败');
      });
    };
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); go.click(); }
    });
    setTimeout(function () { input.focus(); }, 0);
  }

  function renderShelf() {
    var box = featureBlock('文件中转站', '文件拖到球上即可暂存；按住条目可拖出到目标文件夹');
    var list = el('div', 'shelf-list');
    box.appendChild(list);
    var actions = el('div', 'feature-actions');
    var clearBtn = el('button', '', '清空');
    actions.appendChild(clearBtn);
    box.appendChild(actions);

    function draw(items) {
      list.innerHTML = '';
      if (!items || items.length === 0) {
        list.appendChild(el('p', 'feature-hint', '还没有暂存文件'));
        return;
      }
      items.forEach(function (item) {
        var row = el('div', 'feature-row');
        row.draggable = true;
        row.appendChild(el('span', 'name', item.name));
        row.appendChild(el('span', 'group', Math.max(1, Math.round(item.size / 1024)) + ' KB'));
        var removeBtn = el('button', '', '删除');
        removeBtn.draggable = false;
        removeBtn.addEventListener('dragstart', function (event) { event.preventDefault(); });
        removeBtn.onclick = function () {
          api.shelfRemove(item.id).then(function (res) { draw(res && res.items); });
        };
        row.appendChild(removeBtn);
        row.addEventListener('dragstart', function (event) {
          // 掐掉 Chromium 自带的 HTML5 拖拽，只让主进程 startDrag 接管；
          // 两套拖拽会话并存会导致 Windows 上卡死/崩溃
          event.preventDefault();
          api.shelfDragOut(item.id);
        });
        list.appendChild(row);
      });
    }
    clearBtn.onclick = function () {
      api.shelfClear().then(function (res) { draw(res && res.items); });
    };
    api.shelfList()
      .then(function (items) { draw(Array.isArray(items) ? items : []); })
      .catch(function () { draw([]); });
  }

  function renderScreenshot(payload) {
    var box = featureBlock('截图问答', '以下为本地 OCR 文本；截图只在内存中，不落盘');
    if (payload.image) {
      var img = el('img', 'shot-thumb');
      img.src = payload.image;
      img.alt = '截图';
      box.appendChild(img);
    }
    if (payload.error) box.appendChild(el('p', 'feature-hint', 'OCR：' + payload.error));
    var text = payload.text || '';
    if (!text) {
      box.appendChild(el('p', 'feature-hint', '没有识别到文字，可重新截图或在下方直接提问'));
      return;
    }
    var details = document.createElement('details');
    details.appendChild(el('summary', 'feature-hint', 'OCR 文本（点击展开）'));
    details.appendChild(el('div', 'feature-preview', text));
    box.appendChild(details);
    var bar = el('div', 'feature-actions');
    [['解读这张图', 'explain'], ['翻译图中文字', 'translate'], ['提取要点', 'summarize']]
      .forEach(function (pair) {
        var button = el('button', '', pair[0]);
        button.onclick = function () { startPreset(pair[1], text); };
        bar.appendChild(button);
      });
    box.appendChild(bar);
  }

  function renderFeature() {
    if (session.mode === 'palette') renderPalette();
    else if (session.mode === 'capture') renderCapture();
    else if (session.mode === 'shelf') renderShelf();
    else if (session.mode === 'screenshot') renderScreenshot(session);
    else if (session.mode === 'history') renderHistory();
    else els.featurePanel.innerHTML = '';
  }

  function applyModeUI() {
    var featureModes = ['capture', 'palette', 'shelf', 'screenshot', 'history'];
    var isFeature = featureModes.indexOf(session.mode) >= 0;
    els.featurePanel.hidden = !isFeature;
    // feature 模式（命令面板/快速捕捉/中转站/截图）隐藏消息区和 composer，让 feature-panel 撑满剩余空间
    // selection 模式保留 messages + composer（用户可以追问），只额外显示 selectionBar
    els.messages.hidden = isFeature;
    els.composer.hidden = isFeature;
    els.selectionBar.hidden = !(session.mode === 'selection' && session.text);
    els.chatPresets.hidden = session.mode !== 'chat';
  }

  function applyStatus(next) {
    status = next || { configured: false };
    els.modelBadge.textContent = status.configured ? (status.modelName || 'AI') : '未配置';
    els.modelBadge.title = status.modelName
      ? (status.configured ? '当前模型：' + status.modelName : '模型未配置完整：' + status.modelName)
      : '还没有可用模型';
    if (!status.configured) showGuide();
    else els.guide.hidden = true;
  }

  function applySession(next) {
    if (!next) return;
    var mode = next.mode || 'chat';
    var text = next.text || '';
    var image = next.image || '';
    var modeChanged = session.mode !== mode || session.text !== text || session.image !== image;
    session = { mode: mode, text: text, image: image, error: next.error || '', preset: next.preset || '' };
    if (next.theme) applyTheme(next.theme);

    if (modeChanged) {
      // 切模式前归档当前对话，避免新会话把旧内容覆盖
      saveCurrentHistory();
      clearMessages();
      history = [];
      sessionId = null;
      sessionCreatedAt = 0;
    }
    if (session.mode === 'selection' && session.text) {
      els.selectionText.textContent = session.text.length > 220 ? session.text.slice(0, 220) + '…' : session.text;
    }
    applyModeUI();
    renderFeature();

    // 剪贴板卡片带 preset 时自动执行，无需用户再点一次
    if (session.mode === 'selection' && session.preset) {
      startPreset(session.preset, session.text);
    } else if (!els.composer.hidden) {
      els.input.focus();
    }
  }

  function newChat() {
    if (streaming) stopStreaming();
    saveCurrentHistory();
    history = [];
    sessionId = null;
    sessionCreatedAt = 0;
    lastAssistantText = '';
    clearMessages();
    session = { mode: 'chat', text: '', image: '', error: '', preset: '' };
    applyModeUI();
    renderFeature();
    els.input.focus();
  }

  // 头部入口按钮切模式：面板内直接切换，不用关闭重开
  function switchFeatureMode(mode) {
    if (streaming) stopStreaming();
    lastAssistantText = '';
    session = { mode: mode, text: '', image: '', error: '', preset: '' };
    applyModeUI();
    renderFeature();
  }

  // ── 对话历史：复用 history 作为唯一数据源，主进程负责落盘 ──
  function ensureSessionId() {
    if (sessionId) return;
    sessionId = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    sessionCreatedAt = Date.now();
  }

  // label 等展示字段不属于模型协议，发送前剔除（role/content 与改动前完全一致）
  function contextMessages() {
    return history.map(function (item) {
      return { role: item.role, content: item.content };
    });
  }

  function currentTitle() {
    var first = null;
    for (var i = 0; i < history.length; i++) {
      if (history[i].role === 'user') { first = history[i]; break; }
    }
    if (!first) return '新对话';
    var raw = (first.label ? '[' + first.label + '] ' : '') + String(first.content || '');
    return raw.replace(/\s+/g, ' ').trim().slice(0, 24) || '新对话';
  }

  function saveCurrentHistory() {
    if (!history.length) return;
    var idAtCall = sessionId;
    api.historySave({
      id: sessionId || undefined,
      createdAt: sessionCreatedAt || Date.now(),
      title: currentTitle(),
      messages: history.map(function (item) {
        return { role: item.role, content: item.content, label: item.label };
      })
    }).then(function (result) {
      // 保存期间若已切到别的会话（如恢复历史），不覆盖新的 sessionId
      if (result && result.ok && result.id && sessionId === idAtCall) sessionId = result.id;
    }).catch(function () { /* 保存失败不打断对话 */ });
  }

  // onDone 与恢复历史共用的收尾：渲染正文 + 操作条
  function finalizeAssistant(root, body, content) {
    body.innerHTML = formatInline(content);
    addActions(root, content);
  }

  function formatHistoryTime(timestamp) {
    var date = new Date(Number(timestamp) || 0);
    if (isNaN(date.getTime())) return '';
    var now = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var time = pad(date.getHours()) + ':' + pad(date.getMinutes());
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()) {
      return '今天 ' + time;
    }
    var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate()) {
      return '昨天 ' + time;
    }
    return pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + time;
  }

  function openHistoryItem(id) {
    if (streaming) stopStreaming();
    api.historyGet(id).then(function (result) {
      var data = result && result.session;
      if (!data || !Array.isArray(data.messages)) return;
      var messages = data.messages.filter(function (item) {
        return item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string';
      }).slice(-MAX_HISTORY);
      if (!messages.length) return;
      history = messages;
      sessionId = data.id;
      sessionCreatedAt = Number(data.createdAt) || Date.now();
      lastAssistantText = '';
      clearMessages();
      history.forEach(function (item) {
        if (item.role === 'user') {
          appendUser((item.label ? '[' + item.label + '] ' : '') + item.content);
          return;
        }
        var bubble = appendAssistant();
        finalizeAssistant(bubble.root, bubble.body, item.content);
      });
      session = { mode: 'chat', text: '', image: '', error: '', preset: '' };
      applyModeUI();
      renderFeature();
      els.input.focus();
    }).catch(function () { /* 读取失败保持历史列表 */ });
  }

  function renderHistory() {
    var box = featureBlock('对话历史', '点击条目恢复对话；删除后不可恢复');
    var list = el('div', 'history-list');
    box.appendChild(list);
    var actions = el('div', 'feature-actions');
    var clearBtn = el('button', '', '清空');
    actions.appendChild(clearBtn);
    box.appendChild(actions);

    var resetClear = function () {
      clearBtn.dataset.confirm = '';
      clearBtn.textContent = '清空';
    };
    clearBtn.onclick = function () {
      if (clearBtn.dataset.confirm !== '1') {
        clearBtn.dataset.confirm = '1';
        clearBtn.textContent = '确认清空？';
        setTimeout(resetClear, 3000);
        return;
      }
      api.historyClear().then(function (result) {
        draw(result && result.items);
        resetClear();
      }).catch(resetClear);
    };

    function draw(items) {
      list.innerHTML = '';
      if (!items || items.length === 0) {
        list.appendChild(el('p', 'feature-hint', '还没有历史记录'));
        return;
      }
      items.forEach(function (item) {
        var row = el('div', 'feature-row history-row');
        row.appendChild(el('span', 'name', item.title || '新对话'));
        row.appendChild(el('span', 'group', formatHistoryTime(item.updatedAt)));
        var removeBtn = el('button', 'history-remove');
        removeBtn.title = '删除';
        removeBtn.setAttribute('aria-label', '删除');
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="14" y1="11" y2="17"/><line x1="14" x2="10" y1="11" y2="17"/></svg>';
        removeBtn.onclick = function (event) {
          event.stopPropagation();
          api.historyRemove(item.id).then(function (result) {
            draw(result && result.items);
          }).catch(function () { /* 删除失败保持列表 */ });
        };
        row.appendChild(removeBtn);
        row.onclick = function () { openHistoryItem(item.id); };
        list.appendChild(row);
      });
    }

    api.historyList().then(function (result) {
      draw(result && result.items);
    }).catch(function () { draw([]); });
  }

  // ── 流式事件 ──
  function isCurrent(payload) {
    return !!(streaming && payload && payload.requestId === streaming.requestId);
  }

  api.onChunk(function (payload) {
    if (!isCurrent(payload)) return;
    streaming.text += payload.delta || '';
    streaming.body.textContent = streaming.text;
    scrollToBottom();
  });

  api.onThinking(function (payload) {
    if (!isCurrent(payload)) return;
    if (!streaming.thinkingEl) {
      var wrap = document.createElement('details');
      wrap.className = 'thinking';
      var summary = document.createElement('summary');
      summary.textContent = '思考中…';
      var body = document.createElement('div');
      body.className = 'thinking-body';
      wrap.appendChild(summary);
      wrap.appendChild(body);
      els.messages.insertBefore(wrap, streaming.root);
      streaming.thinkingEl = wrap;
      streaming.thinkingBody = body;
    }
    streaming.thinkingBody.textContent += payload.delta || '';
    scrollToBottom();
  });

  api.onDone(function (payload) {
    if (!isCurrent(payload)) return;
    var content = payload.content || streaming.text;
    var root = streaming.root;
    var body = streaming.body;
    streaming = null;
    setBusy(false);
    finalizeAssistant(root, body, content);
    lastAssistantText = content;
    history.push({ role: 'assistant', content: content });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    saveCurrentHistory();
  });

  api.onError(function (payload) {
    if (!isCurrent(payload)) return;
    var failedRoot = streaming.root;
    streaming = null;
    setBusy(false);
    if (failedRoot && !failedRoot.textContent.trim()) {
      failedRoot.remove();
    }
    appendError('请求失败：' + ((payload && payload.message) || '未知错误'));
    if (history.length) saveCurrentHistory();
  });

  api.onSession(function (payload) {
    applySession(payload);
    if (payload && payload.status) applyStatus(payload.status);
  });

  // 主题/模型变化由主进程推送：不重建窗口、不打断正在进行的会话
  api.onTheme(function (theme) {
    applyTheme(theme);
  });

  api.onAIStatus(function (next) {
    applyStatus(next);
  });

  // ── 事件绑定 ──
  els.sendBtn.addEventListener('click', function () {
    if (streaming) stopStreaming();
    else send('chat');
  });

  els.input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      send('chat');
    }
  });

  els.input.addEventListener('input', autoGrow);

  els.closeBtn.addEventListener('click', function () { api.close(); });
  els.historyBtn.addEventListener('click', function () { switchFeatureMode('history'); });
  els.newChatBtn.addEventListener('click', newChat);

  // 头部菜单按钮：点击切换下拉；点击下拉项切换模式；点击外部关闭
  els.headerMenuBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    els.headerDropdown.hidden = !els.headerDropdown.hidden;
  });
  els.headerDropdown.addEventListener('click', function (event) {
    var item = event.target.closest('.header-dropdown-item');
    if (!item) return;
    var mode = item.getAttribute('data-mode');
    els.headerDropdown.hidden = true;
    if (mode === 'screenshot') {
      // 截图问答走独立截图通道，不是面板内 feature mode
      api.requestScreenshot();
      return;
    }
    switchFeatureMode(mode || 'chat');
  });
  document.addEventListener('click', function (event) {
    if (els.headerDropdown.hidden) return;
    if (!els.headerDropdown.contains(event.target) && !els.headerMenuBtn.contains(event.target)) {
      els.headerDropdown.hidden = true;
    }
  });
  els.openSettingsBtn.addEventListener('click', function () { api.openSettings(); });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (streaming) stopStreaming();
      else api.close();
    }
  });

  els.chatPresets.addEventListener('click', function (event) {
    var preset = event.target && event.target.dataset ? event.target.dataset.preset : '';
    if (!preset) return;
    var text = els.input.value.trim();
    // 输入框为空时回退到最近一条 AI 回复，避免用户点 chips 没反应
    if (!text && lastAssistantText) text = lastAssistantText.trim();
    if (!text) return;
    send(preset, text);
  });

  // 存笔记 / 存待办筹码用自己的 onclick（保存中防重入、成功后变跳转入口），
  // 不并入上面的预设委托，避免一次点击同时触发保存与跳转
  els.chatPresets.querySelectorAll('[data-action]').forEach(bindQuickSave);
  // 编辑输入内容后，已变成「打开笔记 / 查看待办」的筹码恢复为保存入口
  els.input.addEventListener('input', resetQuickSaveButtons);

  els.selectionActions.addEventListener('click', function (event) {
    var preset = event.target && event.target.dataset ? event.target.dataset.preset : '';
    if (preset && session.text) send(preset, session.text);
  });

  // ── 初始化 ──
  api.init().then(function (result) {
    if (!result || !result.ok) return;
    // 先就绪模型状态：带 preset 的会话在 applySession 里会立即发起请求
    applyStatus(result.status);
    applySession(result);
    autoGrow();
  }).catch(function () {
    applyStatus({ configured: false });
  });
})();
