/* OWNED_BY: generic. Tech directories consume the already role-filtered menu. */
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const enabled = () => /^(tech|console)\./.test(location.hostname) || new URLSearchParams(location.search).get('app') === 'tech';
  let dirty=false;
  function canLeave(){if(!enabled()||!dirty)return true;if(!confirm('Perubahan belum disimpan. Tinggalkan halaman ini?'))return false;dirty=false;return true;}
  window.addEventListener('beforeunload',e=>{if(enabled()&&dirty){e.preventDefault();e.returnValue='';}});
  const groups = () => window.navigationMenuGroups || [];

  /* ── Default icon map for group areas ────────────────────────── */
  const groupIcons = {
    'tech':       '⚡',
    'agentic':    '🤖',
    'his':        '🏥',
    'lis':        '🔬',
    'ops':        '📊',
    'keuangan':   '💰',
    'logistik':   '📦',
    'sdm':        '👥',
    'mutu':       '✅',
    'konsumen':   '👤',
    'konfigurasi':'⚙️',
    'marketing':  '📣',
    'wellness':   '🌿',
    'korporat':   '🏢',
    'radiologi':  '📡',
    'default':    '📁'
  };

  /* Pick an icon for a group based on its name / id */
  function pickGroupIcon(group) {
    if (group.icon && typeof group.icon === 'string' && group.icon.length <= 4) return group.icon;
    const id = (group.id || group.name || '').toLowerCase();
    for (const [key, ico] of Object.entries(groupIcons)) {
      if (key !== 'default' && id.includes(key)) return ico;
    }
    return groupIcons.default;
  }

  /* ── Breadcrumb trail ────────────────────────────────────────── */
  function trail(group, page) {
    let nav=document.getElementById('tech-page-trail');
    if(!nav){nav=document.createElement('nav');nav.id='tech-page-trail';nav.setAttribute('aria-label','Jejak halaman Tech');document.getElementById('main-content')?.before(nav);}
    nav.innerHTML=`<button type="button" data-home>Tech</button>${group?`<span aria-hidden="true">›</span><button type="button" data-group="${esc(group.id)}">${esc(group.name)}</button>`:''}${page?`<span aria-hidden="true">›</span><span aria-current="page">${esc(page)}</span>`:''}`;
    nav.onclick=e=>{const b=e.target.closest('button');if(!b)return;directory(b.hasAttribute('data-home')?null:b.dataset.group);};
  }

  /* ── Status helper ───────────────────────────────────────────── */
  function statusHtml(item) {
    if (item.soon || item.status === 'belum') {
      return '<span class="tech-card-status tech-card-status--unavailable">Belum tersedia</span>';
    }
    if (item.status === 'parsial') {
      return '<span class="tech-card-status tech-card-status--partial">Fungsi terbatas</span>';
    }
    return '';
  }

  function ctaText(item) {
    if (item.soon || item.status === 'belum') return '';
    if (item.status === 'parsial') return 'Buka halaman';
    return 'Buka halaman';
  }

  /* ── Main directory renderer ─────────────────────────────────── */
  function directory(groupId) {
    if (window.WorkspaceNavigation) return window.WorkspaceNavigation.directory(groupId);
    if(!enabled())return false;
    if(!canLeave())return false;
    const group=groups().find(g=>g.id===groupId);
    // An unknown group never falls through to a privileged module.
    if(groupId&&!group)return false;
    window.closeNavigationContext?.();window.closeModulePicker?.();
    if(innerWidth<768)window.setSidebarOpen?.(false);
    const main=document.getElementById('main-content');if(!main)return false;
    window.currentPage='';
    const title=document.getElementById('topbar-title');if(title)title.textContent=group?.name||'Direktori AVA Tech';
    trail(group);

    let cardsHtml = '';

    if (group) {
      /* ── Specific group: show module cards ───────────────────── */
      const cards = group.services.flatMap(s =>
        s.items.map((item, index) => ({ item, service: group.services.indexOf(s), index }))
      );

      cardsHtml = cards.map(({ item, service, index }) => {
        const isDisabled = item.soon || item.status === 'belum';
        const status = statusHtml(item);
        const cta = ctaText(item);
        return `<button type="button" class="tech-directory-card" data-service="${service}" data-item="${index}" ${isDisabled ? 'disabled' : ''}>
          <div class="tech-card-icon">📄</div>
          <strong>${esc(item.label)}</strong>
          <span>${esc(item.desc || 'Buka halaman fungsi')}</span>
          <small>${status || cta}</small>
        </button>`;
      }).join('');

      if (!cards.length) {
        cardsHtml = '<div class="tech-directory-empty">Tidak ada menu yang tersedia untuk akses Anda.</div>';
      }

    } else {
      /* ── Top-level: show area group cards ─────────────────────── */
      const allGroups = groups();
      cardsHtml = allGroups.map(g => {
        const menuCount = g.services.reduce((n, s) => n + s.items.length, 0);
        const ico = pickGroupIcon(g);
        return `<button type="button" class="tech-directory-card" data-group="${esc(g.id)}">
          <div class="tech-card-icon">${ico}</div>
          <strong>${esc(g.name)}</strong>
          <span>${menuCount} menu sesuai akses Anda</span>
          <small>Lihat menu <span class="tech-card-count">${menuCount}</span></small>
        </button>`;
      }).join('');

      if (!allGroups.length) {
        cardsHtml = '<div class="tech-directory-empty">Tidak ada menu yang tersedia untuk akses Anda.</div>';
      }
    }

    main.innerHTML = `<section class="tech-directory">
      <p class="cat-eyebrow">AVA TECH · DIREKTORI</p>
      <h1 tabindex="-1">${esc(group?.name || 'Pilih area kerja')}</h1>
      <p class="tech-directory-intro">${group
        ? 'Pilih fungsi di bawah untuk membuka halaman kerjanya.'
        : 'Setiap area memiliki halaman menu dan alur kerja tersendiri. Pilih untuk melihat daftar fungsi.'}</p>
      <div class="tech-directory-grid">${cardsHtml}</div>
    </section>`;

    main.querySelector('.tech-directory').onclick = e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.group) directory(b.dataset.group);
      else window.navigateFromContext(group.id, Number(b.dataset.service), Number(b.dataset.item));
    };
    main.scrollTop = 0;
    main.querySelector('h1')?.focus({ preventScroll: true });
    return true;
  }

  function onPage(page){if(!enabled())return;const group=groups().find(g=>g.services.some(s=>s.items.some(i=>i.page===page)));const item=group?.services.flatMap(s=>s.items).find(i=>i.page===page);trail(group,item?.label||page);}
  window.TechNavigation={enabled,directory,onPage,canLeave,setDirty:value=>{dirty=!!value;}};
})();
