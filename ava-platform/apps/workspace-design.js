/* OWNED_BY: generic. Reversible sidebar preferences; existing portal routes preserved. */
(function () {
  const rail=document.getElementById('app-sidebar');if(!rail)return;
  const renderHome=window.renderAppsHome;
  if(renderHome)window.renderAppsHome=function(target){
    renderHome(target);
    const shortcuts=target.querySelector('.apps-shortcuts');if(!shortcuts)return;
    shortcuts.classList.add('apps-directory');
    shortcuts.innerHTML=appsMenuItems(currentRole).map(([label,ids])=>{
      const destinations=ids.filter(id=>!['patient-view','corporate-view','corporate-assigned-program-view'].includes(id)&&APPS_PAGES[id]?.[1]!=='planned');
      if(!destinations.length)return '';
      return `<details class="apps-directory-group"><summary><span class="apps-directory-icon" aria-hidden="true">${glyph}</span><span><strong>${appsEscape(label)}</strong><small>${destinations.length} layanan sesuai akses Anda</small></span><span class="apps-directory-chevron" aria-hidden="true">›</span></summary><div class="apps-directory-children">${destinations.map(id=>`<button type="button" data-view="${appsEscape(id)}">${appsEscape(APPS_PAGES[id][0])}<span aria-hidden="true">›</span></button>`).join('')}</div></details>`;
    }).join('');
    shortcuts.addEventListener('toggle',e=>{if(e.target.open)shortcuts.querySelectorAll('details').forEach(d=>{if(d!==e.target)d.open=false;});},true);
    shortcuts.onclick=e=>{const b=e.target.closest('[data-view]');if(b){b.closest('details').open=false;window.showView(b.dataset.view);}};
  };
  const glyph='<svg class="apps-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg>';
  function paint(){rail.querySelectorAll('.sidebar-link').forEach(b=>{if(!b.querySelector('.apps-nav-icon'))b.insertAdjacentHTML('afterbegin',glyph);b.title=b.textContent.trim();});}
  const nav=document.getElementById('sidebar-nav');if(nav)new MutationObserver(paint).observe(nav,{childList:true,subtree:true});paint();
  const scrim=document.createElement('div');scrim.className='apps-sidebar-scrim';scrim.hidden=true;document.body.append(scrim);
  function mobile(open){rail.classList.toggle('open',open);scrim.hidden=!open;document.querySelector('.menu-toggle-btn')?.setAttribute('aria-expanded',String(open));}
  function compact(value){document.body.classList.remove('apps-sidebar-hidden');document.body.classList.toggle('apps-sidebar-compact',value);button.textContent=value?'›':'‹';button.setAttribute('aria-label',value?'Tampilkan nama menu':'Ringkas sidebar');button.setAttribute('aria-expanded',String(!value));try{localStorage.setItem('portal_sidebar_compact',String(value));}catch(_){}}
  const button=document.createElement('button');button.type='button';button.className='apps-collapse-btn';button.onclick=()=>innerWidth<769?mobile(false):compact(!document.body.classList.contains('apps-sidebar-compact'));rail.querySelector('.sidebar-brand')?.append(button);
  try{compact(localStorage.getItem('portal_sidebar_compact')==='true');}catch(_){compact(false);}
  window.toggleSidebar=()=>{if(innerWidth<769)mobile(!rail.classList.contains('open'));else {const hidden=document.body.classList.toggle('apps-sidebar-hidden');document.querySelector('.menu-toggle-btn')?.setAttribute('aria-expanded',String(!hidden));}};
  scrim.onclick=()=>mobile(false);
  rail.addEventListener('click',e=>{if(e.target.closest('.sidebar-link')&&innerWidth<769)mobile(false);});
  document.addEventListener('click',e=>{if(!e.target.closest('.apps-directory-group'))document.querySelectorAll('.apps-directory-group[open]').forEach(d=>d.open=false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){mobile(false);document.querySelectorAll('.apps-directory-group[open]').forEach(d=>{d.open=false;d.querySelector('summary')?.focus();});}});
  addEventListener('resize',()=>{if(innerWidth>=769)mobile(false);});
})();
