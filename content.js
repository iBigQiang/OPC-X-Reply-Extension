(() => {
  const ARTICLE_SELECTOR = 'article[data-testid="tweet"], article[role="article"], article[tabindex="-1"]';
  const REPLY_BUTTON_SELECTOR = 'button[data-testid="reply"], button[aria-label*="Reply"], button[aria-label*="回复"]';
  const TEXTBOX_SELECTOR = [
    'div[role="textbox"][data-testid^="tweetTextarea_"]',
    'div[role="textbox"][aria-label*="Post"]',
    'div[role="textbox"][aria-label*="发帖"]',
    'div[role="textbox"][aria-label*="回复"]',
    'div[role="textbox"][aria-label*="Reply"]'
  ].join(',');
  const TOOLBAR_SELECTOR = 'div[data-testid="toolBar"]';
  const POST_BUTTON_SELECTOR = 'button[data-testid="tweetButton"], button[data-testid="tweetButtonInline"]';
  const COMPOSER_CONTROL_SELECTOR = `${TOOLBAR_SELECTOR},${POST_BUTTON_SELECTOR}`;
  const INITIAL_SCAN_DELAYS = [450, 1000, 1800, 3200, 5200];

  const STATE = {
    observer: null,
    scanTimer: null,
    followupScanTimers: [],
    activeRequest: false,
    lastTweet: null,
    pendingTweet: null,
    lastInsertedReply: '',
    lastUrl: location.href
  };


  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function detectTweetLanguage(text) {
    const s = String(text || '')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/@[A-Za-z0-9_]{2,20}/g, ' ')
      .replace(/\$[A-Za-z0-9_]+/g, ' ')
      .trim();
    const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
    const latinWords = (s.match(/[A-Za-z]{2,}/g) || []).length;
    const latinLetters = (s.match(/[A-Za-z]/g) || []).length;
    if (latinWords >= 3 && latinLetters > Math.max(cjk * 2, 8)) return 'en';
    if (cjk >= 2) return 'zh';
    return latinWords >= 3 ? 'en' : 'zh';
  }

  function getSmallestRepeatedSegment(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    const compact = s.replace(/\s+/g, '');
    if (compact.length < 6) return null;

    for (let unitLen = 2; unitLen <= Math.floor(compact.length / 2); unitLen++) {
      if (compact.length % unitLen !== 0) continue;
      const unit = compact.slice(0, unitLen);
      const repeatCount = compact.length / unitLen;
      if (repeatCount < 2) continue;
      if (unit.repeat(repeatCount) !== compact) continue;

      let seen = '';
      for (let i = 0; i < s.length; i++) {
        if (!/\s/.test(s[i])) seen += s[i];
        if (seen === unit) return s.slice(0, i + 1).trim();
      }
      return unit;
    }
    return null;
  }

  function dedupeRepeatedText(text) {
    let s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return s;

    // 连续压缩多次，处理“同一句复制 2/3/4 遍”的情况。
    for (let round = 0; round < 5; round++) {
      const before = s;
      const smallest = getSmallestRepeatedSegment(s);
      if (smallest && smallest.length < s.length) s = smallest;

      // 处理“前半段 == 后半段”，中文和英文都适用。
      for (let i = Math.floor(s.length / 2) - 3; i <= Math.floor(s.length / 2) + 3; i++) {
        if (i <= 0 || i >= s.length) continue;
        const a = s.slice(0, i).trim();
        const b = s.slice(i).trim();
        if (a && a === b) {
          s = a;
          break;
        }
      }

      // 处理有标点或空格分隔的重复句。
      const parts = s.split(/(?<=[。！？!?；;])\s*|\s{2,}/).map((x) => x.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const out = [];
        for (const part of parts) {
          const bare = part.replace(/[。.!！?？；;]+$/g, '').trim();
          const last = out.length ? out[out.length - 1].replace(/[。.!！?？；;]+$/g, '').trim() : '';
          if (bare && bare !== last) out.push(part);
        }
        s = out.join(' ').trim();
      }

      if (s === before) break;
    }

    return s;
  }

  function countTextOccurrences(haystack, needle) {
    const h = normalizeText(haystack);
    const n = normalizeText(needle);
    if (!h || !n) return 0;
    let count = 0;
    let pos = 0;
    while ((pos = h.indexOf(n, pos)) !== -1) {
      count += 1;
      pos += Math.max(n.length, 1);
    }
    return count;
  }

  function clickLikeUser(el) {
    if (!el) return;
    try {
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
    } catch (_) {
      try { el.click(); } catch (_) {}
    }
  }

  function toast(message, type = 'info') {
    const old = document.querySelector('.akiii-toast');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'akiii-toast';
    div.textContent = message;
    if (type === 'error') div.classList.add('akiii-toast-error');
    if (type === 'ok') div.classList.add('akiii-toast-ok');
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  }

  function closestArticle(node) {
    return node?.closest?.(ARTICLE_SELECTOR) || null;
  }

  function extractHandles(text) {
    return [...new Set((String(text || '').match(/@[A-Za-z0-9_]{2,20}/g) || []))];
  }

  function getStatusUrl(article) {
    const link = article?.querySelector?.('a[href*="/status/"]');
    if (!link) return location.href;
    try {
      return new URL(link.getAttribute('href'), location.origin).href;
    } catch (_) {
      return location.href;
    }
  }

  function getStatusIdFromHref(href) {
    const match = String(href || '').match(/\/status\/(\d+)/);
    return match?.[1] || '';
  }

  function getCurrentStatusId() {
    return getStatusIdFromHref(location.pathname);
  }

  function getDetailMainTweetMetaHost(article) {
    const currentStatusId = getCurrentStatusId();
    if (!article || !currentStatusId) return null;

    const timeLinks = [...article.querySelectorAll('a[href*="/status/"]')]
      .filter((link) => closestArticle(link) === article)
      .filter((link) => getStatusIdFromHref(link.getAttribute('href')) === currentStatusId)
      .filter((link) => link.querySelector('time[datetime]'))
      .filter((link) => !link.closest('[data-testid="User-Name"]'));
    const timeLink = timeLinks[0];
    if (!timeLink) return null;

    let fallback = timeLink.parentElement?.parentElement || timeLink.parentElement;
    let node = timeLink.parentElement;
    let depth = 0;
    while (node && node !== article && depth < 6) {
      if (closestArticle(node) !== article) return null;
      const text = normalizeText(node.innerText || node.textContent || '');
      if (text.length <= 180 && node.contains(timeLink)) {
        fallback = node;
        const hasAnalyticsLink = [...node.querySelectorAll('a[href*="/analytics"]')]
          .some((link) => closestArticle(link) === article);
        if (hasAnalyticsLink || /(?:查看|views?)/i.test(text)) return node;
      }
      node = node.parentElement;
      depth += 1;
    }

    return fallback && closestArticle(fallback) === article ? fallback : null;
  }

  function extractAuthor(article) {
    const nameBlock = article?.querySelector?.('div[data-testid="User-Name"]');
    const text = nameBlock?.innerText || '';
    const authorHandle = (text.match(/@[A-Za-z0-9_]{2,20}/) || [])[0] || '';
    const name = text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('@') && !/^\d/.test(line)) || '';
    return { name, authorHandle };
  }

  function extractTweetFromArticle(article) {
    if (!article || !article.isConnected) return null;

    const visibleTweetNodes = [...article.querySelectorAll('div[data-testid="tweetText"], div[data-testid="twitterArticleReadView"]')]
      .filter(isVisible);

    let tweetText = visibleTweetNodes
      .map((node) => node.innerText.trim())
      .filter(Boolean)
      .join('\n');

    if (!tweetText) {
      const fallback = article.cloneNode(true);
      fallback.querySelectorAll('button, svg, time, [aria-hidden="true"], .akiii-ai-button, .akiii-menu, [data-testid="toolBar"]').forEach((node) => node.remove());
      tweetText = fallback.innerText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !['Reply', 'Repost', 'Like', 'Share', '回复', '转帖', '喜欢', '分享'].includes(line))
        .slice(0, 24)
        .join('\n');
    }

    const { name, authorHandle } = extractAuthor(article);
    const allText = article.innerText || tweetText;
    const mentionedHandles = extractHandles(tweetText || allText).filter((h) => h !== authorHandle).slice(0, 8);

    const finalText = tweetText || allText || '';
    return {
      tweetText: finalText,
      author: name,
      authorHandle,
      mentionedHandles,
      url: getStatusUrl(article),
      language: detectTweetLanguage(finalText)
    };
  }

  function extractTweetFromDialog(dialog) {
    if (!dialog || !isVisible(dialog)) return null;

    const tweetNodes = [...dialog.querySelectorAll('div[data-testid="tweetText"], div[data-testid="twitterArticleReadView"]')]
      .filter((node) => isVisible(node) && !node.closest('form') && !node.closest(TEXTBOX_SELECTOR));

    let tweetText = tweetNodes
      .map((node) => node.innerText.trim())
      .filter(Boolean)
      .join('\n');

    if (!tweetText) {
      const clone = dialog.cloneNode(true);
      clone.querySelectorAll([
        'button',
        'svg',
        'input',
        'textarea',
        '[role="textbox"]',
        '[data-testid="toolBar"]',
        '[data-testid="tweetButton"]',
        '[data-testid="tweetButtonInline"]',
        '.akiii-ai-button',
        '.akiii-menu',
        '[aria-hidden="true"]'
      ].join(',')).forEach((node) => node.remove());

      const lines = clone.innerText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^(发布你的回复|发你的回复|Post your reply|Reply|回复|AI填入|AI回|草稿|Drafts?)$/i.test(line))
        .filter((line) => !/^回复\s*@/i.test(line))
        .filter((line) => !/^(GIF|图片|照片|投票|位置|表情)$/.test(line));

      // 弹窗里通常是：作者信息 -> 原推内容 -> 回复框。优先保留较像正文的行。
      tweetText = lines
        .filter((line) => !/^@?[A-Za-z0-9_]{2,20}$/.test(line))
        .filter((line) => !/^\d+\s*(小时|分钟|天|h|m|d)$/i.test(line))
        .slice(0, 8)
        .join('\n');
    }

    const nameBlock = [...dialog.querySelectorAll('div[data-testid="User-Name"]')].find((node) => isVisible(node));
    const nameText = nameBlock?.innerText || '';
    const authorHandle = (nameText.match(/@[A-Za-z0-9_]{2,20}/) || [])[0] || '';
    const author = nameText
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('@') && !/^\d/.test(line)) || '';
    const mentionedHandles = extractHandles(tweetText).filter((h) => h !== authorHandle).slice(0, 8);
    const link = dialog.querySelector('a[href*="/status/"]');
    let url = location.href;
    try { if (link) url = new URL(link.getAttribute('href'), location.origin).href; } catch (_) {}

    const finalText = tweetText || '';
    return finalText ? {
      tweetText: finalText,
      author,
      authorHandle,
      mentionedHandles,
      url,
      language: detectTweetLanguage(finalText)
    } : null;
  }

  function extractTweetFromContext(anchor) {
    const article = closestArticle(anchor);
    if (article) return extractTweetFromArticle(article);

    const dialog = anchor?.closest?.('div[role="dialog"]') || document.querySelector('div[role="dialog"]');
    if (dialog && isVisible(dialog)) {
      const fromDialog = extractTweetFromDialog(dialog);
      if (fromDialog?.tweetText) return fromDialog;

      const articles = [...dialog.querySelectorAll(ARTICLE_SELECTOR)].filter(isVisible);
      if (articles.length) return extractTweetFromArticle(articles[0]);

      if (STATE.pendingTweet?.tweetText) return STATE.pendingTweet;
      if (STATE.lastTweet?.tweetText) return STATE.lastTweet;
    }

    const anchorTop = anchor?.getBoundingClientRect?.().top ?? window.innerHeight;
    const articles = [...document.querySelectorAll(ARTICLE_SELECTOR)].filter(isVisible);
    const before = articles.filter((a) => a.getBoundingClientRect().top < anchorTop + 20);
    return extractTweetFromArticle(before.at(-1) || articles[0]) || STATE.pendingTweet || STATE.lastTweet;
  }

  function findVisibleTextboxes(root = document) {
    return [...root.querySelectorAll(TEXTBOX_SELECTOR)].filter((el) => {
      if (!isVisible(el)) return false;
      if (el.closest?.('.akiii-draft-panel')) return false;
      const rect = el.getBoundingClientRect();
      return rect.top > -120 && rect.top < window.innerHeight + 180;
    });
  }

  function getDialogTextboxes() {
    const dialogs = [...document.querySelectorAll('div[role="dialog"]')].filter(isVisible);
    for (let i = dialogs.length - 1; i >= 0; i--) {
      const boxes = findVisibleTextboxes(dialogs[i]);
      if (boxes.length) return boxes;
    }
    return [];
  }

  function getBestTextbox() {
    const active = document.activeElement;
    if (active?.matches?.(TEXTBOX_SELECTOR) && isVisible(active) && active.closest?.('div[role="dialog"]')) return active;

    const dialogBoxes = getDialogTextboxes();
    if (dialogBoxes.length) return dialogBoxes.at(-1);

    if (active?.matches?.(TEXTBOX_SELECTOR) && isVisible(active) && !active.closest?.('.akiii-draft-panel')) return active;

    const boxes = findVisibleTextboxes(document);
    return boxes.at(-1) || null;
  }

  async function getInsertTargets(preferredEditor, timeout = 2500) {
    const targets = [];
    const add = (el) => {
      if (!el || !el.isConnected || !isVisible(el)) return;
      if (!el.matches?.(TEXTBOX_SELECTOR)) return;
      if (el.closest?.('.akiii-draft-panel')) return;
      if (!targets.includes(el)) targets.push(el);
    };

    const dialogBoxes = getDialogTextboxes();
    if (dialogBoxes.length) {
      add(dialogBoxes.at(-1));
      add(preferredEditor);
      return targets;
    }

    add(preferredEditor);
    add(getBestTextbox());
    if (!targets.length) add(await waitForTextbox(timeout));
    return targets;
  }

  async function waitForTextbox(timeout = 8000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const box = getBestTextbox();
      if (box) return box;
      await sleep(120);
    }
    return null;
  }

  function getEditableLeaf(editor) {
    if (!editor) return null;
    const textLeaves = [...editor.querySelectorAll('[data-text="true"], span[data-text="true"]')].filter(isVisible);
    if (textLeaves.length) return textLeaves.at(-1);
    const blocks = [...editor.querySelectorAll('[data-offset-key], [data-block="true"], div, span')].filter(isVisible);
    return blocks.at(-1) || editor;
  }

  function placeCaretAtEnd(el) {
    if (!el) return;
    el.focus();
    const target = getEditableLeaf(el) || el;
    const range = document.createRange();

    try {
      if (target.nodeType === Node.TEXT_NODE) {
        range.setStart(target, target.textContent.length);
      } else if (target.childNodes && target.childNodes.length === 1 && target.firstChild?.nodeType === Node.TEXT_NODE) {
        range.setStart(target.firstChild, target.firstChild.textContent.length);
      } else {
        range.selectNodeContents(target);
        range.collapse(false);
      }
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (_) {
      try {
        const fallbackRange = document.createRange();
        fallbackRange.selectNodeContents(el);
        fallbackRange.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(fallbackRange);
      } catch (_) {}
    }
  }

  function getEditorText(editor) {
    return normalizeText(editor?.innerText || editor?.textContent || '');
  }

  function fireInputEvents(editor, data = '') {
    // 只做状态通知，不再硬改 DOM；避免 X/React 认为这段文字是“死文本”。
    try {
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data
      }));
    } catch (_) {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function copyTextFallback(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      return ok;
    }
  }

  async function tryPasteEvent(editor, text) {
    const before = getEditorText(editor);
    try {
      editor.focus();
      placeCaretAtEnd(editor);
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      });
      editor.dispatchEvent(event);
      await sleep(160);
      const after = getEditorText(editor);
      return after !== before && after.includes(text.slice(0, Math.min(6, text.length)));
    } catch (_) {
      return false;
    }
  }

  async function tryInsertTextCommand(editor, text) {
    const before = getEditorText(editor);
    try {
      editor.focus();
      placeCaretAtEnd(editor);
      const ok = document.execCommand('insertText', false, text);
      fireInputEvents(editor, text);
      await sleep(160);
      const after = getEditorText(editor);
      return Boolean(ok) && after !== before && after.includes(text.slice(0, Math.min(6, text.length)));
    } catch (_) {
      return false;
    }
  }

  async function insertReplyText(editor, text) {
    if (!editor) throw new Error('没有找到回复输入框');
    const clean = dedupeRepeatedText(String(text || '')
      .replace(/\uFFFD/g, '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim());
    if (!clean) throw new Error('生成内容为空');

    // 关键修复：不再 selectNodeContents(editor) 后硬替换整个 X 编辑器。
    // X 的回复框是 React/Draft/ContentEditable 混合结构，硬替换根节点会出现“看得到但不好编辑”。
    // 现在只在当前光标位置做原生 paste/insertText，尽量让 X 自己维护内部编辑状态。
    const already = getEditorText(editor);
    if (already.includes(clean)) {
      placeCaretAtEnd(editor);
      editor.focus();
      return;
    }

    let ok = await tryPasteEvent(editor, clean);
    if (!ok) ok = await tryInsertTextCommand(editor, clean);

    const finalText = getEditorText(editor);
    if (!ok || !finalText.includes(clean.slice(0, Math.min(6, clean.length)))) {
      await copyTextFallback(clean);
      throw new Error('X 拦截了自动填入，已复制内容，可直接手动粘贴');
    }

    editor.dataset.akiiiLastInsert = clean;
    editor.dataset.akiiiLastInsertAt = String(Date.now());
    STATE.lastInsertedReply = clean;
    placeCaretAtEnd(editor);
    editor.focus();
  }

  function closeDraftPanel() {
    document.querySelectorAll('.akiii-draft-panel').forEach((node) => node.remove());
  }

  function normalizeDraftReplies(initialReplies) {
    const rawReplies = Array.isArray(initialReplies) ? initialReplies : [initialReplies];
    return rawReplies
      .map((item) => dedupeRepeatedText(String(item || '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim()))
      .filter(Boolean)
      .slice(0, 3);
  }

  function showDraftPanel(initialReplies, editor) {
    closeDraftPanel();
    const replies = normalizeDraftReplies(initialReplies);
    if (!replies.length) {
      toast('生成内容为空', 'error');
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'akiii-draft-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.tabIndex = -1;
    const panelId = `akiii-draft-${Date.now()}`;
    const manifestVersion = chrome.runtime.getManifest?.().version || '2.1.4';
    const logoUrl = chrome.runtime.getURL('img/Qiangge.png');
    panel.innerHTML = `
      <div class="akiii-draft-head">
        <img class="akiii-draft-logo" src="${logoUrl}" alt="" draggable="false" />
        <div class="akiii-draft-head-text">
          <div class="akiii-draft-title" id="${panelId}-title">X 推文互动回复器 v${manifestVersion}</div>
          <div class="akiii-draft-sub" id="${panelId}-desc">作者：强子手记 @iBigQiang & Akiii @Guomin184935<br>一次生成 3 条候选。先改满意，再填入 X。</div>
        </div>
        <button type="button" class="akiii-draft-close" aria-label="关闭">×</button>
      </div>
      <div class="akiii-draft-list"></div>
    `;
    panel.setAttribute('aria-labelledby', `${panelId}-title`);
    panel.setAttribute('aria-describedby', `${panelId}-desc`);

    const list = panel.querySelector('.akiii-draft-list');
    const closeBtn = panel.querySelector('.akiii-draft-close');
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const closePanel = () => {
      closeDraftPanel();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
    closeBtn.addEventListener('click', closePanel);
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePanel();
      }
    });

    replies.forEach((reply, index) => {
      const item = document.createElement('div');
      item.className = 'akiii-draft-candidate';
      item.setAttribute('role', 'group');
      item.setAttribute('aria-labelledby', `${panelId}-candidate-${index + 1}`);
      item.innerHTML = `
        <div class="akiii-draft-candidate-body">
          <div class="akiii-draft-text-shell">
            <span class="akiii-draft-floating-label" id="${panelId}-candidate-${index + 1}">候选 ${index + 1}</span>
            <textarea class="akiii-draft-text" aria-label="候选 ${index + 1} 回复内容" spellcheck="false" placeholder="生成内容会显示在这里，可以先手动修改"></textarea>
          </div>
          <div class="akiii-draft-candidate-actions">
            <button type="button" class="akiii-draft-copy" aria-label="复制候选 ${index + 1}">复制</button>
            <button type="button" class="akiii-draft-insert" aria-label="填入 X 候选 ${index + 1}">填入 X</button>
          </div>
        </div>
      `;

      const textarea = item.querySelector('.akiii-draft-text');
      const copyBtn = item.querySelector('.akiii-draft-copy');
      const insertBtn = item.querySelector('.akiii-draft-insert');
      textarea.value = reply;

      copyBtn.addEventListener('click', async () => {
        await copyTextFallback(textarea.value.trim());
        copyBtn.textContent = '已复制';
        setTimeout(() => {
          if (copyBtn.isConnected) copyBtn.textContent = '复制';
        }, 1200);
        toast(`候选 ${index + 1} 已复制`, 'ok');
      });

      insertBtn.addEventListener('click', async () => {
        const targets = await getInsertTargets(editor, 2500);
        if (!targets.length) {
          await copyTextFallback(textarea.value.trim());
          toast('没找到回复框，已复制内容', 'error');
          return;
        }
        insertBtn.disabled = true;
        insertBtn.textContent = '填入中';
        try {
          let inserted = 0;
          let firstError = null;
          for (const target of targets) {
            try {
              await insertReplyText(target, textarea.value);
              inserted += 1;
            } catch (err) {
              if (!firstError) firstError = err;
            }
          }
          if (!inserted) throw firstError || new Error('填入失败');
          const filledDialog = targets.some((target) => target.closest?.('div[role="dialog"]') && getEditorText(target).includes(textarea.value.trim().slice(0, 6)));
          toast(filledDialog ? `候选 ${index + 1} 已填入 X 弹窗` : `候选 ${index + 1} 已填入 X`, 'ok');
        } catch (err) {
          toast(err.message || '填入失败', 'error');
        } finally {
          insertBtn.disabled = false;
          insertBtn.textContent = '填入 X';
        }
      });

      list.appendChild(item);
    });

    document.body.appendChild(panel);
    setTimeout(() => {
      const firstTextarea = panel.querySelector('.akiii-draft-text');
      try {
        firstTextarea?.focus({ preventScroll: true });
      } catch (_) {
        firstTextarea?.focus();
      }
      firstTextarea?.setSelectionRange(firstTextarea.value.length, firstTextarea.value.length);
      panel.scrollTop = 0;
    }, 60);
  }


  function sendGenerateRequest(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'generateReply', payload }, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (resp?.ok) resolve(resp.reply);
        else reject(new Error(resp?.error || '生成失败'));
      });
    });
  }

  function sendGenerateRepliesRequest(payload, count = 3) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'generateReplies', payload, count }, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (resp?.ok) resolve(Array.isArray(resp.replies) ? resp.replies : [resp.reply].filter(Boolean));
        else reject(new Error(resp?.error || '生成失败'));
      });
    });
  }

  function createButton(text, className = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `akiii-ai-button ${className}`.trim();
    btn.textContent = text;
    btn.title = 'X 推文互动回复器：生成 3 条可编辑候选，选择后再填入 X';
    return btn;
  }

  function elementMatchesAny(el, selector) {
    return Boolean(el?.matches?.(selector));
  }

  function isTextboxElement(el) {
    return elementMatchesAny(el, TEXTBOX_SELECTOR);
  }

  function hasComposerTextbox(root) {
    return elementMatchesAny(root, TEXTBOX_SELECTOR) || Boolean(root?.querySelector?.(TEXTBOX_SELECTOR));
  }

  function hasComposerControls(root) {
    return elementMatchesAny(root, COMPOSER_CONTROL_SELECTOR) || Boolean(root?.querySelector?.(COMPOSER_CONTROL_SELECTOR));
  }

  function getComposerRoot(anchor) {
    let node = anchor;
    while (node && node !== document.body) {
      if (hasComposerTextbox(node) && hasComposerControls(node)) return node;
      node = node.parentElement;
    }

    node = isTextboxElement(anchor) ? anchor.parentElement : anchor;
    while (node && node !== document.body) {
      if (!isTextboxElement(node) && hasComposerTextbox(node)) return node;
      node = node.parentElement;
    }

    return anchor?.closest?.('form') || anchor?.closest?.('div[role="dialog"], main, section') || anchor?.parentElement || null;
  }

  async function runWithButton(btn, job) {
    if (STATE.activeRequest) {
      toast('上一条还在生成，别急', 'error');
      return;
    }
    STATE.activeRequest = true;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '生成中';
    try {
      await job();
    } catch (error) {
      toast(error.message || '生成失败', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
      STATE.activeRequest = false;
    }
  }

  async function runForArticle(article, btn, style = null) {
    await runWithButton(btn, async () => {
      const tweet = extractTweetFromArticle(article);
      if (!tweet?.tweetText) throw new Error('没有识别到推文内容');
      STATE.lastTweet = tweet;
      STATE.pendingTweet = tweet;

      const replyButton = article.querySelector(REPLY_BUTTON_SELECTOR);
      if (replyButton) {
        clickLikeUser(replyButton);
        toast('正在打开回复框并生成');
      } else {
        toast('正在生成');
      }

      const [editor, replies] = await Promise.all([
        waitForTextbox(8500),
        sendGenerateRepliesRequest({ ...tweet, style }, 3)
      ]);

      if (!editor) throw new Error('没找到回复框，先手动点开回复再试');
      showDraftPanel(replies, editor);
      toast('已生成 3 条候选，可编辑后填入', 'ok');
    });
  }

  async function runForComposer(anchor, btn, style = null) {
    await runWithButton(btn, async () => {
      const tweet = extractTweetFromContext(anchor) || STATE.pendingTweet || STATE.lastTweet;
      if (!tweet?.tweetText) throw new Error('没有识别到要回复的推文');
      STATE.lastTweet = tweet;
      STATE.pendingTweet = tweet;

      const editor = getBestTextbox() || await waitForTextbox(3500);
      if (!editor) throw new Error('没有找到回复输入框');

      toast('正在生成');
      const replies = await sendGenerateRepliesRequest({ ...tweet, style }, 3);
      showDraftPanel(replies, editor);
      toast('已生成 3 条候选，可编辑后填入', 'ok');
    });
  }

  function injectArticleButton(article) {
    if (!article || !isVisible(article)) return;

    const replyButton = article.querySelector(REPLY_BUTTON_SELECTOR);
    if (!replyButton || !isVisible(replyButton)) return;

    const detailMetaHost = getDetailMainTweetMetaHost(article);
    const actionHost = replyButton.closest('[role="group"]') || replyButton.parentElement?.parentElement || replyButton.parentElement;
    const targetHost = detailMetaHost || actionHost;
    if (!targetHost) return;

    const existing = article.querySelector(':scope .akiii-ai-button.akiii-article')
      || [...targetHost.children].find((child) => child.matches?.('.akiii-ai-button.akiii-article'));
    if (existing) {
      existing.classList.toggle('akiii-detail-meta', !!detailMetaHost);
      if (existing.parentElement !== targetHost) targetHost.insertBefore(existing, null);
      return;
    }

    const btn = createButton('AI回', 'akiii-article');
    btn.classList.toggle('akiii-detail-meta', !!detailMetaHost);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      runForArticle(article, btn);
    }, true);
    targetHost.insertBefore(btn, null);
  }

  function injectComposerButton(anchor) {
    if (!anchor || !isVisible(anchor)) return;
    const root = getComposerRoot(anchor);
    if (!root || root.querySelector?.('.akiii-ai-button.akiii-composer')) return;
    if (!root.closest?.('div[role="dialog"], main, section') && !root.matches?.('form, div[role="dialog"], main, section')) return;

    const box = root.querySelector?.(TEXTBOX_SELECTOR) || getBestTextbox();
    if (!box) return;

    const postButton = root.querySelector?.(POST_BUTTON_SELECTOR) || (anchor.matches?.(POST_BUTTON_SELECTOR) ? anchor : null);
    const toolbar = root.querySelector?.(TOOLBAR_SELECTOR) || (anchor.matches?.(TOOLBAR_SELECTOR) ? anchor : null);
    const insertion = postButton?.parentElement
      ? { host: postButton.parentElement, before: postButton }
      : toolbar
        ? { host: toolbar, before: null }
        : null;
    if (!insertion || insertion.host.closest?.(TEXTBOX_SELECTOR)) return;

    const btn = createButton('AI填入', 'akiii-composer');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      runForComposer(anchor, btn);
    }, true);
    insertion.host.insertBefore(btn, insertion.before);
  }

  function scan() {
    if (!document.body) return;
    [...document.querySelectorAll(ARTICLE_SELECTOR)].forEach(injectArticleButton);
    [...document.querySelectorAll(TOOLBAR_SELECTOR)].forEach(injectComposerButton);
    [...document.querySelectorAll(POST_BUTTON_SELECTOR)].forEach(injectComposerButton);
    findVisibleTextboxes(document).forEach(injectComposerButton);

    if (location.href !== STATE.lastUrl) {
      STATE.lastUrl = location.href;
      STATE.lastTweet = null;
      STATE.pendingTweet = null;
      STATE.lastInsertedReply = '';
      scheduleFollowupScans();
    }
  }

  function scheduleScan() {
    clearTimeout(STATE.scanTimer);
    STATE.scanTimer = setTimeout(scan, 260);
  }

  function scheduleFollowupScans() {
    STATE.followupScanTimers.forEach(clearTimeout);
    STATE.followupScanTimers = INITIAL_SCAN_DELAYS.map((delay) => setTimeout(scan, delay));
  }

  function init() {
    scan();
    scheduleFollowupScans();
    STATE.observer = new MutationObserver(scheduleScan);
    STATE.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled', 'aria-disabled', 'data-testid', 'role']
    });
    window.addEventListener('scroll', scheduleScan, { passive: true });
    window.addEventListener('focus', scheduleScan);
    document.addEventListener('click', (e) => {
      const article = closestArticle(e.target);
      if (article && !e.target.closest?.('.akiii-ai-button')) {
        const tweet = extractTweetFromArticle(article);
        if (tweet?.tweetText) {
          STATE.lastTweet = tweet;
          if (e.target.closest?.(REPLY_BUTTON_SELECTOR)) STATE.pendingTweet = tweet;
        }
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
