/* OWNED_BY: generic. Tech directories consume the already role-filtered menu. */
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const enabled = () => /^(tech|console)\./.test(location.hostname) || new URLSearchParams(location.search).get('app') === 'tech';
  let dirty=false;
  function canLeave(){if(!enabled()||!dirty)return true;if(!confirm('Perubahan belum disimpan. Tinggalkan halaman ini?'))return false;dirty=false;return true;}
  window.addEventListener('beforeunload',e=>{if(enabled()&&dirty){e.preventDefault();e.returnValue='';}});
  const groups = () => window.navigationMenuGroups || [];
  function trail(group, page) {
    let nav=document.getElementById('tech-page-trail');
    if(!nav){nav=document.createElement('nav');nav.id='tech-page-trail';nav.setAttribute('aria-label','Jejak halaman Tech');document.getElementById('main-content')?.before(nav);}
    nav.innerHTML=`<button type="button" data-home>Tech</button>${group?`<span aria-hidden="true">›</span><button type="button" data-group="${esc(group.id)}">${esc(group.name)}</button>`:''}${page?`<span aria-hidden="true">›</span><span aria-current="page">${esc(page)}</span>`:''}`;
    nav.onclick=e=>{const b=e.target.closest('button');if(!b)return;directory(b.hasAttribute('data-home')?null:b.dataset.group);};
  }
  function directory(groupId) {
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
    const cards=group?group.services.flatMap(s=>s.items.map((item,index)=>({item,service:group.services.indexOf(s),index}))):[];
    main.innerHTML=`<section class="tech-directory"><p class="cat-eyebrow">AVA TECH · DIREKTORI</p><h1 tabindex="-1">${esc(group?.name||'Pilih area kerja')}</h1><p class="tech-directory-intro">${group?'Pilih fungsi untuk membuka halaman kerjanya.':'Setiap area memiliki halaman menu dan alur kerja tersendiri.'}</p><div class="tech-directory-grid">${group?cards.map(({item,service,index})=>`<button type="button" class="tech-directory-card" data-service="${service}" data-item="${index}" ${item.soon||item.status==='belum'?'disabled':''}><strong>${esc(item.label)}</strong><span>${esc(item.desc||'Buka halaman fungsi')}</span><small>${item.soon||item.status==='belum'?'Belum tersedia':item.status==='parsial'?'Fungsi terbatas · buka halaman':'Buka halaman →'}</small></button>`).join(''):groups().map(g=>`<button type="button" class="tech-directory-card" data-group="${esc(g.id)}"><strong>${esc(g.name)}</strong><span>${g.services.reduce((n,s)=>n+s.items.length,0)} menu sesuai akses Anda</span><small>Lihat menu →</small></button>`).join('')}</div>${!(group?cards.length:groups().length)?'<p role="status">Tidak ada menu yang tersedia untuk akses Anda.</p>':''}</section>`;
    main.querySelector('.tech-directory').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.group)directory(b.dataset.group);else window.navigateFromContext(group.id,Number(b.dataset.service),Number(b.dataset.item));};
    main.scrollTop=0;main.querySelector('h1')?.focus({preventScroll:true});return true;
  }
  function onPage(page){if(!enabled())return;const group=groups().find(g=>g.services.some(s=>s.items.some(i=>i.page===page)));const item=group?.services.flatMap(s=>s.items).find(i=>i.page===page);trail(group,item?.label||page);}
  window.TechNavigation={enabled,directory,onPage,canLeave,setDirty:value=>{dirty=!!value;}};
})();
