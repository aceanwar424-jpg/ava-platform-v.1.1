/* OWNED_BY: generic. Page presentation, with existing module storage contracts. */
(function () {
  const enabled = () => !!window.TechNavigation?.enabled() && !!document.getElementById('main-content');
  if(enabled())document.body.classList.add('tech-pages-enabled');
  let frames = [];
  let pending=0;
  function isSaving(){return pending>0||!!document.querySelector('.tech-record-content button[type=submit]:disabled');}
  function runAction(handler,target,event){
    const result=handler.call(target,event);
    if(!result?.then)return result;
    pending++;
    return Promise.resolve(result).finally(()=>pending--);
  }
  const sections = {
    'tech-control-plane': [['Ringkasan operasi','ringkasan'],['Kesehatan sistem','kesehatan'],['Tiket & tindak lanjut','tiket'],['Deployment tenant','deployment'],['Tenant & klien','tenants',{page:'tenants'}],['Lisensi & aktivasi','license',{page:'tech-aktivasi'}],['Setup SATUSEHAT','integration',{page:'master-records',params:{domain:'satusehat_setup'}}],['Status signing desktop','pengaturan'],['Telemetri instalasi','telemetry',{page:'tech-telemetri'}],['Jejak audit','audit',{page:'audit'}]],
    finance: [['Invoice','invoice'],['Pembayaran','payment'],['Laporan','report'],['Komisi sales','commission']],
    hrd: [['Data karyawan','emp'],['Absensi & cuti','leave'],['Penggajian','payroll']],
    'db-studio': [['Penjelajah data','tables'],['Editor kueri','query']]
  };
  const selected = {};
  function selection(page, fallback, explicit=false) {
    const pending = window.workspacePanelTarget;
    if (pending?.page === page) { selected[page] = pending.panel; window.workspacePanelTarget = null; }
    else if(explicit)selected[page]=fallback;
    return selected[page] || fallback;
  }
  function finish() {
    if (!frames.length) return false;
    const frame = frames[0]; frames = [];
    document.getElementById('main-content').replaceChildren(...frame.nodes);
    window.TechNavigation.setDirty(false);
    if(frame.route)window.TechRoutes?.commit(frame.route.page,frame.route.params,true);else window.TechRoutes?.list();
    if(frame.focus?.isConnected)frame.focus.focus();
    return true;
  }
  function back() {
    if (!window.TechNavigation.canLeave()) return false;
    return finish();
  }
  function open(html) {
    const main = document.getElementById('main-content');
    if (!enabled()) return false;
    if (frames.length && !window.TechNavigation.canLeave()) return false;
    if (!frames.length) frames.push({nodes: [...main.childNodes],focus:document.activeElement,route:window.TechRoutes?.frameRoute()});
    main.innerHTML = '<section class="tech-record-page"><button type="button" class="btn btn-ghost tech-record-back">← Kembali ke daftar</button><div class="tech-record-content"></div></section>';
    const content = main.querySelector('.tech-record-content'); content.innerHTML = html;
    const title=content.querySelector('h1,h2,h3,.modal-title');
    if(title&&title.tagName!=='H1'){const heading=document.createElement('h1');heading.textContent=title.textContent;if(title.id)heading.id=title.id;title.replaceWith(heading);}
    content.querySelectorAll('[onclick]').forEach(button => {
      const handler = button.getAttribute('onclick');
      button.setAttribute('onclick', handler.replace(/closeModal(?:Force)?\s*\(\s*\)/g, 'if(!TechPages.back())return'));
      if(/^(?:save[A-Z]\w*|(?:tp|tl|tnt|tcp|pnw|ag)\w*(?:Simpan|Save|Eksekusi|Kirim|Buat|Cabut|PilihItem)\w*)\([^;]*\);?$/.test(handler.trim())){
        button.setAttribute('onclick','return '+handler);
        const save=button.onclick;
        button.onclick=event=>{event.preventDefault();if(button.dataset.pending)return;button.dataset.pending='true';try{return Promise.resolve(runAction(save,button,event)).finally(()=>delete button.dataset.pending);}catch(error){delete button.dataset.pending;throw error;}};
      }
    });
    content.querySelectorAll('form[onsubmit]').forEach(form=>{
      const handler=form.getAttribute('onsubmit').trim();
      if(/^[a-zA-Z]\w*\([^;]*\);?$/.test(handler)){
        form.setAttribute('onsubmit','return '+handler);const submit=form.onsubmit;
        form.onsubmit=event=>{event.preventDefault();return runAction(submit,form,event);};
      }
    });
    content.querySelectorAll('.input-group,.form-group').forEach(group=>{const label=group.querySelector('label'),control=group.querySelector('input,select,textarea');if(label&&control?.id&&!label.contains(control))label.htmlFor=control.id;});
    main.querySelector('.tech-record-back').onclick = back;
    content.addEventListener('input', () => window.TechNavigation.setDirty(true));
    content.addEventListener('change', () => window.TechNavigation.setDirty(true));
    window.TechNavigation.setDirty(false);
    window.TechRoutes?.openRecord();
    main.scrollTop = 0;
    content.querySelector('input:not([type=hidden]),textarea,select')?.focus();
    return true;
  }
  window.TechPages = {enabled,open,back,finish,selection,sections,isSaving};
  // Navigating to another list invalidates the detached record page.
  new MutationObserver(() => {
    if (frames.length && !document.querySelector('#main-content > .tech-record-page')) {
      frames = []; window.TechNavigation.setDirty(false);
    }
  }).observe(document.getElementById('main-content') || document.body,{childList:true});
})();
