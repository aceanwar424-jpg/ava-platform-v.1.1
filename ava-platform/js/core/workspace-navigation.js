/* OWNED_BY: generic. Presentation only; destinations come from RBAC-filtered menus. */
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groups = () => window.navigationMenuGroups || [];
  const svg = (name, size=18) => typeof window.icon === 'function' ? window.icon(name,size) : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h6"/></svg>`;
  const arrow = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  const iconName = label => /database|data|katalog/i.test(label)?'database':/kendali|pengaturan|konfigurasi/i.test(label)?'sliders':/riwayat|arsip/i.test(label)?'clock':/tenant|karyawan|sdm/i.test(label)?'users':/modul|versi/i.test(label)?'layers':/tiket/i.test(label)?'inbox':'file-text';
  const panels = {
    'tech-control-plane': [['Ringkasan operasi','ringkasan'],['Kesehatan sistem','kesehatan'],['Tiket & tindak lanjut','tiket'],['Deployment tenant','deployment'],['Pengaturan & trace','pengaturan']]
  };
  const settingsIcon=document.querySelector('#workspace-settings-btn > span:first-child');
  if(settingsIcon){settingsIcon.innerHTML=svg('settings');settingsIcon.style.color='inherit';}
  const notification=document.querySelector('.topbar-btn[title="Notifikasi Sistem"]');
  if(notification){[...notification.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.remove());notification.insertAdjacentHTML('afterbegin',svg('bell'));}
  function closeChildren(focus=false) {
    document.querySelectorAll('.workspace-tile-toggle[aria-expanded=true]').forEach(b => {
      b.setAttribute('aria-expanded','false'); document.getElementById(b.getAttribute('aria-controls')).hidden=true;
      if(focus)b.focus();
    });
  }
  function trail(group, label) {
    return `<nav id="workspace-page-trail" aria-label="Jejak halaman"><button type="button" data-home>Area kerja</button>${group?`<span aria-hidden="true">/</span><button type="button" data-group="${esc(group.id)}">${esc(group.name)}</button>`:''}${label?`<span aria-hidden="true">/</span><span aria-current="page">${esc(label)}</span>`:''}</nav>`;
  }
  function child(group,s,i,panel,label) {
    const item=group.services[s].items[i], unavailable=item.soon||item.status==='belum';
    return `<button type="button" class="workspace-child" data-service="${s}" data-item="${i}" ${panel?`data-panel="${esc(panel)}"`:''} ${unavailable?'disabled':''}>${svg(iconName(label||item.label),16)}<span>${esc(label||item.label)}${unavailable?' · Belum tersedia':''}</span>${arrow}</button>`;
  }
  function tile(title,desc,children,attrs,state='') {
    const id='workspace-child-'+tile.count++;
    return `<article class="workspace-tile"><div class="workspace-tile-head"><span class="workspace-tile-icon">${svg(iconName(title))}</span><div class="workspace-tile-copy"><strong>${esc(title)}</strong><p>${esc(desc)}</p>${state?`<span class="workspace-tile-state">${esc(state)}</span>`:''}</div><button type="button" class="workspace-tile-toggle" ${attrs} ${children?`aria-expanded="false" aria-controls="${id}"`:''} aria-label="${esc((children?'Tampilkan submenu ':'Buka ')+title)}">${arrow}</button></div>${children?`<div id="${id}" class="workspace-children" hidden>${children}</div>`:''}</article>`;
  }
  function directory(groupId) {
    if(!document.body.classList.contains('ava-ops-shell'))return false;
    const group=groups().find(g=>g.id===groupId);
    if(groupId&&!group)return false;
    if(window.TechNavigation?.enabled()&&!window.TechNavigation.canLeave())return false;
    const main=document.getElementById('main-content');if(!main)return false;
    window.closeNavigationContext?.();window.closeModulePicker?.();
    window.workspacePanelTarget=null;
    if(innerWidth<769)window.setSidebarOpen?.(false);
    document.getElementById('tech-page-trail')?.remove();
    tile.count=0;
    let cards;
    if(!group) cards=groups().map(g=>tile(g.name,`${g.services.reduce((n,s)=>n+s.items.length,0)} fungsi sesuai akses Anda`,'',`data-group="${esc(g.id)}"`)).join('');
    else cards=group.services.map((service,s)=>{
      if(service.name&&service.items.length>1) return tile(service.name,`${service.items.length} fungsi tersedia`,service.items.map((item,i)=>child(group,s,i)).join(''),'');
      return service.items.map((item,i)=>{
        const children=panels[item.page]?.map(([label,panel])=>child(group,s,i,panel,label)).join('');
        const unavailable=item.soon||item.status==='belum';
        return tile(item.label,item.desc||'Buka halaman kerja',children,children?'':`data-service="${s}" data-item="${i}" ${unavailable?'disabled':''}`,unavailable?'Belum tersedia':item.status==='parsial'?'Fungsi terbatas':'');
      }).join('');
    }).join('');
    main.innerHTML=`<section class="workspace-directory">${trail(group)}<h1>${esc(group?.name||'Area kerja')}</h1><p class="workspace-directory-intro">Pilih fungsi atau buka panah untuk melihat submenu.</p><div class="workspace-directory-grid">${cards||'<p>Tidak ada menu yang tersedia untuk akses Anda.</p>'}</div></section>`;
    window.currentPage='';
    document.getElementById('topbar-title').textContent=group?.name||'Area kerja';
    window.updateBreadcrumb?.('');
    const domain=document.getElementById('breadcrumb-domain');if(domain)domain.textContent='Area kerja';
    const serviceWrap=document.getElementById('breadcrumb-service-wrap');if(serviceWrap)serviceWrap.hidden=true;
    const pageWrap=document.getElementById('breadcrumb-page-wrap');if(pageWrap)pageWrap.hidden=!group;
    document.querySelectorAll('.sidebar-main-btn').forEach(b=>b.classList.toggle('active-group',!!group&&b.closest('.sidebar-accordion-group')?.id===group.id));
    main.querySelector('.workspace-directory').onclick=e=>{
      const b=e.target.closest('button');if(!b||b.disabled)return;
      if(b.hasAttribute('data-home'))return directory();
      if(b.dataset.group)return directory(b.dataset.group);
      if(b.hasAttribute('aria-controls')) {
        const open=b.getAttribute('aria-expanded')==='true';closeChildren();
        b.setAttribute('aria-expanded',String(!open));document.getElementById(b.getAttribute('aria-controls')).hidden=open;return;
      }
      if(b.dataset.item!==undefined) {
        if(window.TechNavigation?.enabled()&&!window.TechNavigation.canLeave())return;
        // Only existing panel names; no arbitrary actions or query execution.
        if(b.dataset.panel)window.workspacePanelTarget={page:group.services[+b.dataset.service].items[+b.dataset.item].page,panel:b.dataset.panel};
        window.navigateFromContext(group.id,+b.dataset.service,+b.dataset.item);
      }
    };
    main.scrollTop=0; return true;
  }
  function onPage(page) {
    const group=groups().find(g=>g.services.some(s=>s.items.some(i=>i.page===page)));
    const item=group?.services.flatMap(s=>s.items).find(i=>i.page===page);
    const main=document.getElementById('main-content');
    document.getElementById('tech-page-trail')?.remove();
    main?.querySelector('#workspace-page-trail')?.remove();
    // Router replaces main content after this call; use the header breadcrumb for pages.
    document.querySelectorAll('.sidebar-main-btn').forEach(b=>b.classList.toggle('active-group',!!group&&b.closest('.sidebar-accordion-group')?.id===group.id));
    if(window.workspacePanelTarget?.page!==page)window.workspacePanelTarget=null;
  }
  document.addEventListener('click',e=>{if(!e.target.closest('.workspace-tile'))closeChildren();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeChildren(true);});
  window.WorkspaceNavigation={directory,onPage};
})();
