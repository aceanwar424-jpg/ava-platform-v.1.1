/* OWNED_BY: ava. Public navigation only; no authentication or patient data. */
(() => {
  document.documentElement.classList.add('js-ready');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#navigation');
  const close = () => { toggle?.setAttribute('aria-expanded', 'false'); nav?.classList.remove('open'); };
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
    nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('open')) { close(); toggle.focus(); } });
  }
  const filters = document.querySelector('.filters');
  if (filters) filters.hidden = false;
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let count = 0;
    document.querySelectorAll('[data-category]').forEach(item => {
      item.hidden = button.dataset.filter !== 'semua' && item.dataset.category !== button.dataset.filter;
      if (!item.hidden) count++;
    });
    document.querySelector('#filter-result').textContent = `${count} produk dan layanan ditampilkan.`;
  }));
  const revealBrand = () => {
    const section = document.getElementById(location.hash.slice(1));
    if (section?.classList.contains('brand-card')) section.querySelector('details').open = true;
  };
  window.addEventListener('hashchange', revealBrand);
  revealBrand();

  // Approved visual library. Copy and interaction stay native HTML; these
  // images provide atmosphere, context, and conceptual workflow support only.
  const visualAssets = {
    'portal.html': { hero: 'ava-ecosystem-hero.jpg', alt: 'Keluarga dan tenaga kesehatan dalam ilustrasi ekosistem AVA', caption: 'Visual ekosistem AVA', position: '72% center' },
    'public/ekosistem.html': { hero: 'ava-ecosystem-overview.jpg', alt: 'Ilustrasi hubungan layanan kesehatan, laboratorium, teknologi, dan wellness AVA', caption: 'Visual ekosistem terhubung' },
    'public/brand-health.html': { hero: 'queen-health-hero.jpg', support: 'patient-journey.jpg', alt: 'Tenaga kesehatan berbicara dengan pasien', supportAlt: 'Ilustrasi perjalanan layanan pasien', caption: 'Queen Health', supportCaption: 'Ilustrasi alur layanan pasien', position: '82% center' },
    'public/brand-lab.html': { hero: 'queen-lab-hero.jpg', support: 'laboratory-journey.jpg', alt: 'Analis bekerja di laboratorium diagnostik', supportAlt: 'Ilustrasi perjalanan pemeriksaan laboratorium', caption: 'Queen Lab', supportCaption: 'Ilustrasi alur pemeriksaan laboratorium', position: '70% center' },
    'public/brand-tech.html': { hero: 'ava-tech-hero.jpg', support: 'ava-tech-workflow.jpg', alt: 'Ilustrasi perangkat dan workflow teknologi AVA', supportAlt: 'Ilustrasi hubungan HIS, LIS, dan Apps', caption: 'AVA Tech', supportCaption: 'Ilustrasi workflow teknologi AVA', position: '70% center' },
    'public/corporate.html': { hero: 'corporate-health-hero.jpg', support: 'corporate-mcu-journey.jpg', alt: 'Tim profesional membahas program kesehatan korporat', supportAlt: 'Ilustrasi perjalanan layanan kesehatan korporat', caption: 'Corporate Health', supportCaption: 'Ilustrasi alur corporate health', position: '74% center' },
    'public/ava-his.html': { hero: 'ava-his-showcase.jpg', alt: 'Visual konseptual antarmuka AVA HIS', caption: 'Visual konseptual — bukan screenshot produk aktual', conceptual: true },
    'public/ava-lis.html': { hero: 'ava-lis-showcase.jpg', alt: 'Visual konseptual antarmuka AVA LIS', caption: 'Visual konseptual — bukan screenshot produk aktual', conceptual: true },
    'public/ava-apps.html': { hero: 'ava-apps-showcase.jpg', alt: 'Visual konseptual aplikasi AVA Apps', caption: 'Visual konseptual — bukan screenshot produk aktual', conceptual: true },
    'public/solusi.html': { hero: 'integrated-platforms.jpg', support: 'provider-solution.jpg', alt: 'Ilustrasi keterhubungan AVA HIS, LIS, dan Apps', supportAlt: 'Ilustrasi solusi AVA untuk penyedia layanan kesehatan', caption: 'Ilustrasi ekosistem AVA Tech', supportCaption: 'Ilustrasi solusi untuk penyedia layanan kesehatan', conceptual: true },
    'public/brand-care.html': { hero: 'queen-care-hero.jpg', alt: 'Dua perempuan berbincang dalam suasana layanan Queen Care', caption: 'Queen Care', position: '72% center' },
    'public/brand-sanctuary.html': { hero: 'queen-wellness-hero.jpg', alt: 'Ruang tenang untuk pengalaman wellness Queen', caption: 'Queen Wellness Sanctuary', position: '72% center' },
    'public/brand-nutrition.html': { hero: 'queen-nutrition-hero.jpg', alt: 'Konsultasi dan bahan makanan dalam konteks Queen Nutrition', caption: 'Queen Nutrition', position: '72% center' },
    'public/produk.html': { hero: 'queen-nutrition-hero.jpg', alt: 'Konsultasi dan bahan makanan dalam konteks Queen Nutrition', caption: 'Queen Nutrition', position: '72% center' },
    'public/kemitraan.html': { hero: 'partnership-hero.jpg', alt: 'Tim berdiskusi dalam konteks kemitraan AVA Health', caption: 'Kemitraan AVA Health' },
    'public/investasi.html': { hero: 'investor-growth.jpg', alt: 'Ilustrasi pertumbuhan ekosistem kesehatan AVA', caption: 'Ekosistem AVA Health' },
    'public/tentang.html': { hero: 'about-ava.jpg', alt: 'Tim AVA Health dalam ilustrasi tentang perusahaan', caption: 'Tentang AVA Health' },
    'public/jurnal.html': { hero: 'journal-insights.jpg', alt: 'Koleksi topik insight kesehatan dan teknologi AVA', caption: 'AVA Insights' },
    'public/kalkulator.html': { hero: 'health-tools.jpg', alt: 'Ilustrasi alat informasi kesehatan AVA', caption: 'Health tools untuk informasi, bukan diagnosis' },
    'public/kontak.html': { hero: 'contact-cta.jpg', alt: 'Tim AVA Health siap membantu percakapan awal', caption: 'Hubungi AVA Health', position: '72% center' },
    'public/layanan.html': { hero: 'provider-solution.jpg', alt: 'Ilustrasi solusi AVA untuk penyedia layanan kesehatan', caption: 'Solusi AVA untuk penyedia layanan kesehatan', position: '70% center' }
  };

  const pageVisual = visualAssets[document.body.dataset.page || ''];
  const assetPath = name => `public/assets/visuals/${name}`;
  const figure = (src, alt, caption, conceptual = false, support = false, position = 'center') => {
    const node = document.createElement('figure');
    node.className = support ? 'ava-visual ava-visual-support' : 'ava-visual';
    const image = document.createElement('img');
    image.src = assetPath(src);
    image.alt = alt;
    image.width = 1440;
    image.height = 720;
    image.style.objectPosition = position;
    image.loading = support ? 'lazy' : 'eager';
    image.decoding = 'async';
    if (!support) image.fetchPriority = 'high';
    const note = document.createElement('figcaption');
    note.textContent = caption;
    if (conceptual) note.classList.add('is-conceptual');
    node.append(image, note);
    return node;
  };

  // The official portrait is already a public project asset. Reuse it instead
  // of leaving the company profile with an empty photo treatment.
  document.querySelectorAll('.founder-photo-inner:not(.has-photo)').forEach(slot => {
    const portrait = document.createElement('img');
    portrait.src = 'public/assets/ace-darojatun-anwar.png';
    portrait.alt = 'Ace Darojatun Anwar, Founder, Owner dan CEO AVA Health Solution';
    portrait.width = 1024;
    portrait.height = 1536;
    portrait.loading = 'eager';
    portrait.decoding = 'async';
    slot.classList.add('has-photo');
    slot.replaceChildren(portrait);
  });

  if (pageVisual) {
    const hero = document.querySelector('.v2-hero-visual, .detail-hero, .tech-priority .section-heading');
    if (hero) {
      const visual = figure(pageVisual.hero, pageVisual.alt, pageVisual.caption, pageVisual.conceptual, false, pageVisual.position);
      if (hero.classList.contains('v2-hero-visual')) hero.replaceChildren(visual.querySelector('img'), visual.querySelector('figcaption'));
      else { hero.classList.add('has-ava-visual'); hero.append(visual); }
    }
    if (pageVisual.support) {
      const host = document.querySelector('.brand-section .wrap, .section .wrap');
      if (host) host.append(figure(pageVisual.support, pageVisual.supportAlt, pageVisual.supportCaption, pageVisual.conceptual, true));
    }
  }

  // Product pages intentionally avoid presenting conceptual artwork as a
  // released interface. Use the relevant approved asset so the page never
  // shows a blank demo box, while retaining an explicit conceptual label.
  document.querySelectorAll('.screenshot-placeholder').forEach(slot => {
    slot.setAttribute('aria-label', 'Visual konsep produk AVA; bukan screenshot produk aktual');
    if (!pageVisual?.hero) return;
    const image = document.createElement('img');
    image.src = assetPath(pageVisual.hero);
    image.alt = pageVisual.alt;
    image.width = 1440;
    image.height = 720;
    image.loading = 'eager';
    image.decoding = 'async';
    const caption = document.createElement('p');
    caption.textContent = 'Visual konseptual untuk konteks pembahasan; bukan screenshot produk aktual.';
    slot.classList.add('has-visual');
    slot.replaceChildren(image, caption);
  });

  // Vendor-neutral conversion event architecture. If an analytics provider is
  // added later it can consume dataLayer without changing public CTAs.
  window.AVA_PUBLIC_EVENTS = Object.freeze([
    'nav_service_click',
    'appointment_request',
    'lab_inquiry',
    'corporate_inquiry',
    'tech_demo_request',
    'partnership_request',
    'investor_deck_request',
    'health_tool_open',
    'contact_submit'
  ]);
  window.dataLayer = window.dataLayer || [];
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-event]');
    if (!link) return;
    window.dataLayer.push({
      event: link.dataset.event,
      page: document.body.dataset.page || location.pathname,
      destination: link.getAttribute('href') || '',
      label: link.textContent.trim().replace(/\s+/g, ' ')
    });
  });
})();
