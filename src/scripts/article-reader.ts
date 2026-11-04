const reader = document.querySelector<HTMLElement>('[data-article-reader]');

if (reader) {
  const header = document.querySelector<HTMLElement>('.site-header');
  const toc = reader.querySelector<HTMLDetailsElement>('.reader-toc details');
  const desktop = matchMedia('(min-width: 1041px)');
  const links = [...reader.querySelectorAll<HTMLAnchorElement>('.reader-toc a')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1))!);
  let headerHeight = header?.offsetHeight || 76;
  let pending = false;

  // 标题锚点：悬停显示 #，点击跳到该节并复制完整链接
  reader.querySelectorAll<HTMLElement>('.prose :is(h2, h3, h4)[id]').forEach(heading => {
    const label = heading.textContent?.trim() || '';
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${heading.id}`;
    anchor.setAttribute('aria-label', `复制「${label}」的链接`);
    anchor.title = '复制本节链接';
    anchor.textContent = '#';
    anchor.addEventListener('click', async () => {
      const url = `${location.origin}${location.pathname}${location.search}#${heading.id}`;
      try {
        await navigator.clipboard.writeText(url);
        anchor.textContent = '✓';
        anchor.dataset.copied = 'true';
      } catch {
        anchor.textContent = '#';
      }
      setTimeout(() => {
        anchor.textContent = '#';
        delete anchor.dataset.copied;
      }, 1400);
    });
    heading.append(anchor);
  });

  const updateCurrent = () => {
    pending = false;
    let current = 0;
    for (let index = 0; index < sections.length; index++) {
      if (sections[index].getBoundingClientRect().top <= headerHeight + 36) current = index;
    }
    if (scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = sections.length - 1;
    links.forEach((link, index) => {
      if (index === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const active = links[current];
    const nav = toc?.querySelector('nav');
    if (active && nav && toc?.open && desktop.matches) {
      const linkRect = active.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      if (linkRect.top < navRect.top) nav.scrollTop -= navRect.top - linkRect.top;
      else if (linkRect.bottom > navRect.bottom) nav.scrollTop += linkRect.bottom - navRect.bottom;
    }
  };
  const scheduleCurrent = () => {
    if (!pending) { pending = true; requestAnimationFrame(updateCurrent); }
  };
  const measureHeader = () => {
    headerHeight = header?.getBoundingClientRect().height || 76;
    reader.style.setProperty('--reader-header-height', `${headerHeight}px`);
    scheduleCurrent();
  };
  if (toc) {
    const summary = toc.querySelector('summary')!;
    const syncLayout = () => {
      toc.open = desktop.matches;
      summary.tabIndex = desktop.matches ? -1 : 0;
      scheduleCurrent();
    };
    summary.addEventListener('click', event => { if (desktop.matches) event.preventDefault(); });
    desktop.addEventListener('change', syncLayout);
    syncLayout();
    links.forEach((link, index) => link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (!desktop.matches) toc.open = false;
      const section = sections[index];
      section.tabIndex = -1;
      history.pushState(null, '', link.hash);
      requestAnimationFrame(() => {
        section.focus({ preventScroll: true });
        section.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        scheduleCurrent();
      });
    }));
    addEventListener('scroll', scheduleCurrent, { passive: true });
    addEventListener('resize', scheduleCurrent, { passive: true });
    addEventListener('hashchange', scheduleCurrent);
  }
  if (header) new ResizeObserver(measureHeader).observe(header);
  measureHeader();

  // 阅读进度条：顶栏上沿的 2px 细线，跟随滚动（无论有没有目录都生效）
  const progressFill = reader.querySelector<HTMLElement>('[data-reading-fill]');
  const syncProgress = () => {
    if (!progressFill) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    progressFill.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
  };
  addEventListener('scroll', syncProgress, { passive: true });
  addEventListener('resize', syncProgress);
  syncProgress();

  const dialog = reader.querySelector<HTMLDialogElement>('.image-viewer')!;
  const largeImage = dialog.querySelector<HTMLImageElement>('.viewer-image')!;
  const closeButton = dialog.querySelector<HTMLButtonElement>('.viewer-close')!;
  const previous = dialog.querySelector<HTMLButtonElement>('.viewer-prev')!;
  const next = dialog.querySelector<HTMLButtonElement>('.viewer-next')!;
  const count = dialog.querySelector<HTMLElement>('.viewer-count')!;
  const caption = dialog.querySelector<HTMLElement>('.viewer-caption')!;
  const status = dialog.querySelector<HTMLElement>('.viewer-status')!;
  const images = [...reader.querySelectorAll<HTMLImageElement>('.prose img')].filter(image => !image.closest('a, button, summary'));
  let selected = 0;
  let opener: HTMLImageElement | null = null;
  let savedOverflow = '';
  let savedPadding = '';

  const showImage = (index: number) => {
    selected = index;
    const image = images[index];
    largeImage.hidden = false;
    status.hidden = true;
    largeImage.alt = image.alt;
    largeImage.src = image.currentSrc || image.src;
    caption.textContent = image.dataset.viewerCaption || '';
    caption.hidden = !caption.textContent;
    count.textContent = `${index + 1} / ${images.length}`;
    previous.hidden = next.hidden = images.length < 2;
    previous.disabled = index === 0;
    next.disabled = index === images.length - 1;
  };
  const openImage = (image: HTMLImageElement) => {
    if (!image.complete || !image.naturalWidth) return;
    opener = image;
    showImage(images.indexOf(image));
    savedOverflow = document.body.style.overflow;
    savedPadding = document.body.style.paddingRight;
    const scrollbar = innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeButton.focus();
  };
  images.forEach(image => {
    image.dataset.viewerCaption = image.alt || image.title;
    image.dataset.zoomable = '';
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-haspopup', 'dialog');
    image.setAttribute('aria-label', image.alt ? `放大图片：${image.alt}` : '放大图片');
    image.title = '放大图片';
    image.addEventListener('click', () => openImage(image));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openImage(image); }
    });
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target === dialog.querySelector('.viewer-stage')) dialog.close();
  });
  previous.addEventListener('click', () => { if (selected > 0) showImage(selected - 1); });
  next.addEventListener('click', () => { if (selected < images.length - 1) showImage(selected + 1); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && selected > 0) { event.preventDefault(); showImage(selected - 1); }
    if (event.key === 'ArrowRight' && selected < images.length - 1) { event.preventDefault(); showImage(selected + 1); }
  });
  largeImage.addEventListener('error', () => {
    largeImage.hidden = true;
    status.textContent = '图片暂时无法加载';
    status.hidden = false;
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPadding;
    opener?.focus({ preventScroll: true });
    scheduleCurrent();
  });
}

export {};
