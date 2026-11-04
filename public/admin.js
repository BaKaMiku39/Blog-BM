/*
 * 写作后台交互。
 * 依赖 admin.astro 里的 DOM id（#title / #body / #save-post …），改结构时请同步。
 *
 * 设计约定，别在后续改动里破坏：
 *   1. 动作只有两种后果：存草稿（不公开）与发布（公开）。已发布文章的“保存”＝更新线上内容。
 *   2. 保存中不靠“变灰”表达禁用，用顶部进度条 + 按钮内 spinner + 只读，文字对比度不降。
 *   3. 报错必须落到具体字段，不允许只在顶部飘一行字。
 */

(() => {
  const shell = document.getElementById('shell');
  if (!shell) return;

  const $ = id => document.getElementById(id);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const BACKUP_KEY = 'bakamiku-editor-backup';
  const FIELDS = ['title', 'description', 'body', 'category', 'tags', 'date', 'cover', 'badge'];
  const SPINNER = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

  const state = {
    posts: [],
    slug: '',
    draft: true,
    dirty: false,
    busy: false,
    filter: 'all',
    query: '',
  };

  const el = {
    list: $('post-list'),
    listPanel: $('list-panel'),
    settings: $('settings-panel'),
    editorScroll: $('editor-scroll'),
    search: $('post-search'),
    title: $('title'),
    description: $('description'),
    body: $('body'),
    category: $('category'),
    tags: $('tags'),
    date: $('date'),
    cover: $('cover'),
    badge: $('badge'),
    preview: $('preview'),
    publish: $('publish'),
    savePost: $('save-post'),
    saveStatus: $('save-status'),
    statePill: $('state-pill'),
    topbarTitle: $('topbar-title'),
    publicLink: $('public-link'),
    publicLink2: $('public-link-2'),
    publicRow: $('public-row'),
    saveHelp: $('save-help'),
    menu: $('more-menu'),
    menuButton: $('more-btn'),
    banner: $('backup-banner'),
    dialog: $('confirm-dialog'),
  };

  const errors = {
    title: { input: el.title, slot: $('title-error') },
    body: { input: el.body, slot: $('body-error') },
    date: { input: el.date, slot: $('date-error') },
    cover: { input: el.cover, slot: $('cover-error') },
    category: { input: el.category, slot: $('category-error') },
  };

  const today = () => new Date().toLocaleDateString('en-CA');
  const clock = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

  /* ---------- 状态与提示 ---------- */

  function setStatus(text, kind = 'idle') {
    el.saveStatus.textContent = text;
    el.saveStatus.dataset.state = kind;
  }

  function setFieldError(name, message) {
    const entry = errors[name];
    if (!entry) return;
    entry.slot.textContent = message;
    entry.slot.dataset.state = 'error';
    entry.input?.classList.add('is-invalid');
    entry.input?.setAttribute('aria-invalid', 'true');
  }

  function clearErrors() {
    Object.values(errors).forEach(entry => {
      entry.slot.textContent = '';
      entry.slot.dataset.state = '';
      entry.input?.classList.remove('is-invalid');
      entry.input?.removeAttribute('aria-invalid');
    });
    $('category-status').textContent = '';
    $('category-status').dataset.state = '';
  }

  function focusField(name) {
    const entry = errors[name];
    if (!entry?.input) return;
    entry.input.focus({ preventScroll: false });
    entry.input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------- 确认对话框 ---------- */

  let confirmResolve = null;

  function askConfirm({ title, text, ok = '确定', danger = false }) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    const okButton = $('confirm-ok');
    okButton.textContent = ok;
    okButton.className = `adm-btn ${danger ? 'adm-btn--danger' : 'adm-btn--primary'}`;
    el.dialog.returnValue = '';
    el.dialog.showModal();
    return new Promise(resolve => { confirmResolve = resolve; });
  }

  $('confirm-ok').addEventListener('click', () => el.dialog.close('ok'));
  $('confirm-cancel').addEventListener('click', () => el.dialog.close('cancel'));
  el.dialog.addEventListener('close', () => {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve?.(el.dialog.returnValue === 'ok');
  });

  /* ---------- 表单读写 ---------- */

  function readForm(action = 'save') {
    return {
      slug: state.slug,
      title: el.title.value,
      description: el.description.value,
      body: el.body.value,
      category: el.category.value,
      tags: [...new Set(el.tags.value.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))],
      date: el.date.value,
      cover: el.cover.value.trim(),
      badge: el.badge.value,
      action,
      draft: state.draft,
    };
  }

  function applyForm(post) {
    el.title.value = post?.title || '';
    el.description.value = post?.description || '';
    el.body.value = post?.body || '';
    el.category.value = post?.category || '技术笔记';
    el.tags.value = post?.tags?.join(', ') || '';
    el.date.value = post?.date || today();
    el.cover.value = post?.cover || '';
    el.badge.value = post?.badge || '';
    el.topbarTitle.textContent = post?.title || '新文章';
  }

  /* ---------- 动作区同步（草稿 / 已发布 两套形态） ---------- */

  function syncActions() {
    const published = !state.draft && Boolean(state.slug);

    el.statePill.dataset.state = published ? 'published' : 'draft';
    el.statePill.textContent = published ? '已发布' : '草稿';

    if (published) {
      el.publish.hidden = true;
      el.savePost.className = 'adm-btn adm-btn--primary';
      el.savePost.textContent = '更新文章';
      el.savePost.title = '直接更新线上内容，发布时间与排序不变';
      el.publicLink.hidden = false;
      el.publicLink.href = `/posts/${state.slug}`;
      el.publicLink2.href = `/posts/${state.slug}`;
      el.publicRow.hidden = false;
      el.saveHelp.textContent = '这是已发布文章：保存会直接更新线上内容，发布时间和排序不变。';
    } else {
      el.publish.hidden = false;
      el.publish.className = 'adm-btn adm-btn--primary';
      el.publish.textContent = '发布';
      el.publish.title = '公开这篇文章';
      el.savePost.className = 'adm-btn adm-btn--ghost';
      el.savePost.textContent = '存草稿';
      el.savePost.title = '只保存在草稿里，不公开';
      el.publicLink.hidden = true;
      el.publicRow.hidden = true;
      el.saveHelp.textContent = '存草稿不会公开；点发布后文章才会出现在前台。';
    }

    const hasPost = Boolean(state.slug);
    ['delete-post', 'delete-post-2'].forEach(id => { $(id).disabled = !hasPost || state.busy; });
  }

  /* ---------- 列表 ---------- */

  function visiblePosts() {
    const query = state.query.trim().toLowerCase();
    return state.posts.filter(post => {
      if (state.filter === 'draft' && !post.draft) return false;
      if (state.filter === 'published' && post.draft) return false;
      if (!query) return true;
      return `${post.title} ${post.category} ${post.tags.join(' ')}`.toLowerCase().includes(query);
    });
  }

  function renderList() {
    const draftCount = state.posts.filter(post => post.draft).length;
    $('count-all').textContent = state.posts.length;
    $('count-draft').textContent = draftCount;
    $('count-published').textContent = state.posts.length - draftCount;
    $('post-count').textContent = state.posts.length;

    const items = visiblePosts();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'adm-list-empty';
      empty.textContent = state.posts.length
        ? '没有匹配的文章，换个关键词或筛选试试'
        : '还没有文章。点右上角的 + 写第一篇。';
      el.list.replaceChildren(empty);
      return;
    }

    el.list.replaceChildren(...items.map(post => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `adm-item${post.slug === state.slug ? ' is-active' : ''}${post.draft ? ' is-draft' : ''}`;

      const title = document.createElement('span');
      title.className = 'adm-item-title';
      title.textContent = post.title || '（无标题）';

      const meta = document.createElement('span');
      meta.className = 'adm-item-meta';
      const dot = document.createElement('i');
      dot.className = 'adm-dot';
      dot.dataset.state = post.draft ? 'draft' : 'published';
      const label = document.createElement('span');
      label.textContent = post.draft ? '草稿' : '已发布';
      const rest = document.createElement('span');
      rest.textContent = `· ${post.category} · ${post.date}`;
      meta.append(dot, label, rest);

      button.append(title, meta);
      button.addEventListener('click', () => switchPost(post));
      return button;
    }));
  }

  async function refresh() {
    const res = await fetch('/api/posts');
    if (res.status === 401) { location.reload(); return; }
    if (!res.ok) { setStatus('列表加载失败，请刷新页面', 'error'); return; }
    const data = await res.json();
    state.posts = data.posts || [];
    renderList();
  }

  /* ---------- 载入一篇文章 ---------- */

  function loadPost(post, keepDirty = false) {
    clearTimeout(autosaveTimer);
    state.slug = post?.slug || '';
    state.draft = post ? post.draft !== false : true;
    applyForm(post);
    clearErrors();
    el.editorScroll.scrollTop = 0;

    if (!keepDirty) {
      state.dirty = false;
      // 右侧状态只表达「和服务器是否一致」，文章生命周期由左侧胶囊负责，不要重复写「已发布」
      setStatus(post ? '已同步' : '准备就绪', post ? 'saved' : 'idle');
      try { localStorage.removeItem(BACKUP_KEY); } catch {}
    }

    syncActions();
    renderList();
    setDrawer('settings', false);
    setDrawer('list', false);
    setView('write');
  }

  async function switchPost(post) {
    if (post.slug === state.slug) { setView('write'); return; }
    if (state.dirty) {
      const ok = await askConfirm({
        title: '切换文章？',
        text: '当前修改还没保存，切换后会丢失。',
        ok: '仍然切换',
        danger: true,
      });
      if (!ok) return;
    }
    loadPost(post);
  }

  /* ---------- 保存 / 发布 ---------- */

  let autosaveTimer;

  function markDirty() {
    if (state.busy) return;
    state.dirty = true;
    el.topbarTitle.textContent = el.title.value || '新文章';
    setStatus('未保存', 'pending');
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (!state.dirty) return;
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(readForm('save')));
        if (!state.busy) setStatus('已在本机暂存', 'pending');
      } catch {}
    }, 700);
  }

  function setBusy(on) {
    state.busy = on;
    shell.classList.toggle('is-busy', on);
    [el.editorScroll, el.settings, el.listPanel].forEach(node => { if (node) node.inert = on; });
    syncActions();
  }

  function validate() {
    clearErrors();
    if (!el.title.value.trim()) {
      setFieldError('title', '标题不能为空');
      focusField('title');
      return false;
    }
    if (!el.body.value.trim()) {
      setFieldError('body', '正文不能为空');
      focusField('body');
      return false;
    }
    const date = el.date.value.trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFieldError('date', '日期格式应为 YYYY-MM-DD');
      focusField('date');
      return false;
    }
    const cover = el.cover.value.trim();
    if (cover && !/^\/(uploads|images)\/\S*$/.test(cover)) {
      setFieldError('cover', '封面路径需以 /uploads/ 或 /images/ 开头，否则不会保存');
      focusField('cover');
      return false;
    }
    return true;
  }

  /** 把后端返回的整句错误拆回具体字段，避免只在顶部飘一行字 */
  function handleServerError(message) {
    if (/标题和正文不能为空/.test(message)) {
      if (!el.title.value.trim()) { setFieldError('title', '标题不能为空'); focusField('title'); return; }
      if (!el.body.value.trim()) { setFieldError('body', '正文不能为空'); focusField('body'); return; }
    }
    if (/日期格式/.test(message)) { setFieldError('date', message); focusField('date'); return; }
    if (/大类/.test(message)) { setFieldError('category', message); focusField('category'); return; }
    setStatus(message, 'error');
  }

  async function save(action) {
    if (state.busy) return;
    if (!validate()) { setStatus('请先补全标红的字段', 'error'); return; }

    const button = action === 'publish' ? el.publish : el.savePost;
    setBusy(true);
    button.dataset.busy = 'true';
    button.innerHTML = `<span class="adm-spin">${SPINNER}</span>${action === 'publish' ? '发布中…' : '保存中…'}`;
    setStatus(action === 'publish' ? '正在发布…' : '正在保存…', 'busy');
    clearTimeout(autosaveTimer);

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(readForm(action)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      state.dirty = false;
      try { localStorage.removeItem(BACKUP_KEY); } catch {}
      await refresh();
      loadPost(data.post);
      setStatus(`${action === 'publish' ? '已发布' : '已保存'} · ${clock()}`, 'saved');
      setView('write');
    } catch (error) {
      handleServerError(error.message || '保存失败');
      setStatus('保存失败 · 未写入', 'error');
    } finally {
      button.innerHTML = '';
      delete button.dataset.busy;
      setBusy(false);
    }
  }

  /* ---------- 删除 ---------- */

  async function removePost() {
    if (!state.slug) return;
    const ok = await askConfirm({
      title: '删除这篇文章？',
      text: `《${el.title.value || '无标题'}》会被永久删除，无法撤销。`,
      ok: '永久删除',
      danger: true,
    });
    if (!ok) return;
    setStatus('删除中…', 'busy');
    const res = await fetch(`/api/posts/${state.slug}`, { method: 'DELETE' });
    if (!res.ok) { setStatus('删除失败', 'error'); return; }
    await refresh();
    loadPost(null);
    setStatus('文章已删除', 'saved');
  }

  /* ---------- 新建 ---------- */

  async function newPost() {
    if (state.dirty) {
      const ok = await askConfirm({
        title: '新建文章？',
        text: '当前修改还没保存，新建后会丢失。',
        ok: '仍然新建',
        danger: true,
      });
      if (!ok) return;
    }
    loadPost(null);
    el.title.focus();
  }

  /* ---------- 工具栏 ---------- */

  function insert(before, after = '', placeholder = '文字') {
    const area = el.body;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selection = area.value.slice(start, end) || placeholder;
    area.setRangeText(before + selection + after, start, end, 'select');
    area.focus();
    markDirty();
  }

  $$('.adm-toolbar button[data-wrap]').forEach(button => {
    button.addEventListener('click', () => insert(button.dataset.wrap, button.dataset.wrap));
  });
  $$('.adm-toolbar button[data-prefix]').forEach(button => {
    button.addEventListener('click', () => insert(button.dataset.prefix, '', '标题或内容'));
  });
  $('insert-image').addEventListener('click', () => $('image-file').click());

  const codeButton = document.querySelector('.adm-toolbar button[data-block="code"]');
  codeButton?.addEventListener('click', () => insert('\n```ts\n', '\n```\n', 'console.log("Hello");'));
  document.querySelector('.adm-toolbar button[data-block="link"]')?.addEventListener('click', () => insert('[', '](https://example.com)'));

  $('image-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('正在上传图片…', 'busy');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      insert(`![${file.name}](${data.url})`, '', '');
      setStatus(`图片已插入 · ${clock()}`, 'saved');
    } catch (error) {
      setStatus(error.message || '上传失败', 'error');
    } finally {
      event.target.value = '';
    }
  });

  /* ---------- 预览 ---------- */

  async function switchTab(view) {
    const preview = view === 'preview';
    $$('.adm-tab').forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    el.body.hidden = preview;
    el.preview.hidden = !preview;
    shell.classList.toggle('is-preview', preview);
    if (!preview) return;

    el.preview.innerHTML = '<p class="adm-hint">正在渲染…</p>';
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: el.body.value }),
      });
      const data = await res.json();
      el.preview.innerHTML = data.html || '<p class="adm-hint">预览暂不可用</p>';
    } catch {
      el.preview.innerHTML = '<p class="adm-hint">预览渲染失败，请稍后重试</p>';
    }
  }

  $$('.adm-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.view)));

  /* ---------- 抽屉与视图 ---------- */

  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
  const isNarrow = () => window.matchMedia('(max-width: 1279px)').matches;

  function setDrawer(name, open) {
    shell.dataset[name] = open ? 'open' : 'closed';
    if (name === 'settings') $('settings-toggle').setAttribute('aria-expanded', String(open));
  }

  function setView(view) {
    shell.dataset.view = view;
    $$('.adm-tabbar button').forEach(button => button.classList.toggle('is-active', button.dataset.view === view));
    // 离开写作视图时退出预览态，否则设置/列表会被 is-preview 一起隐藏
    if (view !== 'write' && shell.classList.contains('is-preview')) {
      shell.classList.remove('is-preview');
      el.body.hidden = false;
      el.preview.hidden = true;
      $$('.adm-tab').forEach(tab => {
        const active = tab.dataset.view === 'edit';
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
    }
  }

  $('list-toggle').addEventListener('click', () => {
    if (isMobile()) { setView('list'); return; }
    setDrawer('list', shell.dataset.list !== 'open');
  });

  $('settings-toggle').addEventListener('click', () => {
    if (isMobile()) { setView('settings'); return; }
    setDrawer('settings', shell.dataset.settings !== 'open');
  });

  $('settings-close').addEventListener('click', () => {
    if (isMobile()) { setView('write'); return; }
    setDrawer('settings', false);
  });
  $('scrim').addEventListener('click', () => { setDrawer('settings', false); setDrawer('list', false); });

  $$('.adm-tabbar button').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  window.addEventListener('resize', () => {
    if (!isNarrow()) setDrawer('settings', false);
    setDrawer('list', false);
  });

  /* ---------- 更多菜单 ---------- */

  function closeMenu() {
    el.menu.hidden = true;
    el.menuButton.setAttribute('aria-expanded', 'false');
  }

  el.menuButton.addEventListener('click', event => {
    event.stopPropagation();
    const open = el.menu.hidden;
    el.menu.hidden = !open;
    el.menuButton.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', event => {
    if (!el.menu.hidden && !el.menu.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  /* ---------- 大类 ---------- */

  async function addCategory() {
    const input = $('new-category');
    const button = $('create-category');
    const status = $('category-status');
    if (button.disabled) return;
    status.dataset.state = '';
    if (!input.value.trim()) {
      status.textContent = '请输入大类名称';
      status.dataset.state = 'error';
      input.focus();
      return;
    }
    button.disabled = true;
    status.textContent = '添加中…';
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '添加失败');
      if (![...el.category.options].some(option => option.value === data.category)) {
        el.category.add(new Option(data.category, data.category));
      }
      el.category.value = data.category;
      el.category.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = '';
      status.textContent = `已添加并选中「${data.category}」`;
      status.dataset.state = 'ok';
      markDirty();
    } catch (error) {
      status.textContent = error.message || '添加失败';
      status.dataset.state = 'error';
    } finally {
      button.disabled = false;
    }
  }

  $('create-category').addEventListener('click', addCategory);
  $('new-category').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); addCategory(); }
  });

  /* ---------- 绑定 ---------- */

  FIELDS.forEach(id => $(id).addEventListener('input', markDirty));

  $('save-post').addEventListener('click', () => save('save'));
  el.publish.addEventListener('click', () => save('publish'));
  $('new-post').addEventListener('click', () => { closeMenu(); newPost(); });
  $('new-post-2').addEventListener('click', newPost);
  $('delete-post').addEventListener('click', () => { closeMenu(); removePost(); });
  $('delete-post-2').addEventListener('click', removePost);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
  };
  $('logout').addEventListener('click', logout);
  $('logout-2').addEventListener('click', () => { closeMenu(); logout(); });

  $('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
  });

  el.search.addEventListener('input', () => {
    state.query = el.search.value;
    renderList();
  });

  $$('.adm-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.filter;
      $$('.adm-chip').forEach(other => other.classList.toggle('is-active', other === chip));
      renderList();
    });
  });

  document.addEventListener('keydown', event => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save('save');
    }
    if (meta && document.activeElement === el.body && ['b', 'i'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      const wrap = event.key.toLowerCase() === 'b' ? '**' : '*';
      insert(wrap, wrap);
    }
  });

  window.addEventListener('beforeunload', event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  /* ---------- 本机暂存恢复 ---------- */

  function checkBackup() {
    let raw = null;
    try { raw = localStorage.getItem(BACKUP_KEY); } catch {}
    if (!raw) return;
    el.banner.hidden = false;

    $('backup-restore').addEventListener('click', () => {
      try {
        const post = JSON.parse(raw);
        state.slug = post.slug || '';
        state.draft = post.draft !== false;
        applyForm(post);
        state.dirty = true;
        syncActions();
        renderList();
        setStatus('已恢复本机暂存 · 未保存', 'pending');
      } catch {
        try { localStorage.removeItem(BACKUP_KEY); } catch {}
        setStatus('暂存内容已损坏，已清除', 'error');
      }
      el.banner.hidden = true;
    });

    $('backup-discard').addEventListener('click', () => {
      try { localStorage.removeItem(BACKUP_KEY); } catch {}
      el.banner.hidden = true;
      setStatus('已丢弃暂存内容', 'idle');
    });
  }

  /* ---------- 启动 ---------- */

  (async function init() {
    loadPost(null);
    await refresh();
    renderList();
    checkBackup();
  })();
})();
