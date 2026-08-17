// ═══════════════════════════════════════════════════════════════
// WIKI · CONTENT STUDIO & MEDIA
// - Content Studio: generate konten (artikel, sosmed, caption, email,
//   skrip video) via AI, simpan/edit/salin/download.
// - Media: generate gambar via AI, simpan ke Storage bucket "wiki".
// ═══════════════════════════════════════════════════════════════

const CONTENT_TYPES = ['Artikel','Post Sosmed','Caption','Email Blast','Skrip Video','Judul & Hook','Lainnya'];
const CONTENT_TONES = ['Profesional','Edukatif','Ramah','Persuasif','Santai','Empatik','Urgent'];
const CONTENT_CHANNELS = ['Instagram','WhatsApp','Facebook','LinkedIn','TikTok','Blog/Web','Email','Cetak'];
const IMAGE_STYLES = ['Fotografi realistis','Ilustrasi flat','3D render','Infografis','Minimalis','Medis/klinis','Poster promosi'];

let _contentResult='', _contentModel='';

// ═══ CONTENT STUDIO ═══════════════════════════════════════════
function renderWikiContentTab(el){
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:340px 1fr;gap:14px;align-items:start">
      <div class="wiki-card">
        <div class="wiki-sec">Brief Konten</div>
        <div class="form-group"><label>Topik / Brief *</label>
          <textarea id="ct-topic" rows="3" placeholder="mis. Edukasi pentingnya cek gula darah puasa untuk karyawan"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Jenis</label>
            <select id="ct-type">${CONTENT_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div>
          <div class="form-group"><label>Channel</label>
            <select id="ct-channel">${CONTENT_CHANNELS.map(t=>`<option>${t}</option>`).join('')}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Tone</label>
            <select id="ct-tone">${CONTENT_TONES.map(t=>`<option>${t}</option>`).join('')}</select></div>
          <div class="form-group"><label>Panjang</label>
            <select id="ct-len"><option>Pendek</option><option selected>Sedang</option><option>Panjang</option></select></div>
        </div>
        <div class="form-group"><label>Target Audiens</label>
          <input id="ct-aud" placeholder="mis. HR korporat, usia 30-50"></div>
        <div class="form-group"><label>Call to Action</label>
          <input id="ct-cta" placeholder="mis. Hubungi WA OneLab untuk jadwal MCU"></div>
        <button class="btn btn-teal" style="width:100%" id="ct-run" onclick="runContentGen()">${svgIcon('sparkle',15)} Generate Konten</button>
        <div style="font-size:11px;color:var(--gray);margin-top:8px">Hasil bisa langsung disimpan & dipakai untuk generate gambar.</div>
      </div>

      <div>
        <div id="ct-output"></div>
        <div class="wiki-card" style="margin-top:14px">
          <div class="wiki-sec">Konten Tersimpan (${wikiContents.length})</div>
          ${wikiContents.length?`<div style="overflow-x:auto"><table class="pro-grid"><thead><tr>
            <th>Judul</th><th>Jenis</th><th>Channel</th><th>Status</th><th>Dibuat</th><th></th>
          </tr></thead><tbody>
          ${wikiContents.slice(0,20).map(c=>`<tr>
            <td style="font-weight:600">${c.title||'—'}</td>
            <td style="font-size:11.5px">${c.content_type||''}</td>
            <td style="font-size:11.5px;color:var(--gray)">${c.channel||'—'}</td>
            <td><span class="wiki-badge" style="background:var(--bg2);color:#475569">${c.status||'Draft'}</span></td>
            <td style="font-size:11px;color:var(--gray)">${c.created_at?new Date(c.created_at).toLocaleDateString('id-ID'):''}</td>
            <td><div class="act-row">
              <button class="act-btn" title="Lihat" onclick="viewContent(${c.id})">${svgIcon('eye',14)}</button>
              <button class="act-btn del" onclick="deleteContent(${c.id})">${svgIcon('trash',14)}</button>
            </div></td></tr>`).join('')}
          </tbody></table></div>`:`<div style="color:var(--gray);font-size:12px;padding:10px 0">Belum ada konten tersimpan.</div>`}
        </div>
      </div>
    </div>`;
  if(_contentResult) renderContentOutput();
}

async function runContentGen(){
  const V=i=>document.getElementById(i)?.value?.trim()||'';
  const topic=V('ct-topic');
  if(!topic){ toast('Topik/brief wajib diisi','err'); return; }
  const type=V('ct-type'), channel=V('ct-channel'), tone=V('ct-tone'), len=V('ct-len'), aud=V('ct-aud'), cta=V('ct-cta');
  const btn=document.getElementById('ct-run'), out=document.getElementById('ct-output');
  if(btn){ btn.disabled=true; btn.innerHTML='⏳ Menulis...'; }
  out.innerHTML=`<div class="wiki-card"><div class="loading-row"><div class="spinner"></div> AI sedang menulis konten…</div></div>`;
  try{
    const system=`Kamu copywriter kesehatan untuk OneLab (laboratorium klinik & layanan MCU/home care) di Indonesia.
Tulis dalam Bahasa Indonesia yang akurat secara medis namun mudah dipahami awam.
JANGAN membuat klaim medis berlebihan, jangan menjanjikan diagnosis/kesembuhan, dan jangan mengarang angka statistik.
Keluaran dalam Markdown, siap pakai, tanpa basa-basi pembuka.`;
    const prompt=`Buat ${type} untuk channel ${channel}.
Topik/brief: ${topic}
Tone: ${tone} · Panjang: ${len}
${aud?`Target audiens: ${aud}`:''}
${cta?`Call to action: ${cta}`:''}

Format keluaran:
1. "# Judul" yang menarik (maks 12 kata)
2. Isi konten sesuai jenis & channel${channel==='Instagram'||channel==='TikTok'?' (sertakan hook 1 kalimat di awal)':''}
3. Bagian "## Hashtag" (5-10 hashtag relevan) — hanya jika channel media sosial
4. Bagian "## Ide Visual" berisi 1 paragraf deskripsi gambar pendukung yang cocok

Pastikan informasi medis aman dan sesuai etika promosi layanan kesehatan Indonesia.`;
    const d=await wikiAI({mode:'text', prompt, system, temperature:0.7});
    _contentResult=d.text||''; _contentModel=d.model||'';
    renderContentOutput();
    toast('✅ Konten dibuat','ok');
  }catch(e){
    out.innerHTML=`<div class="status-box status-err">❌ ${e.message}
      <div style="font-size:11.5px;margin-top:6px">Pastikan Edge Function <code>gemini-proxy</code> ter-deploy &amp; <code>GEMINI_API_KEY</code> terisi.</div></div>`;
  }
  if(btn){ btn.disabled=false; btn.innerHTML=`${svgIcon('sparkle',15)} Generate Konten`; }
}

function renderContentOutput(){
  const out=document.getElementById('ct-output'); if(!out) return;
  out.innerHTML=`<div class="wiki-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <div class="wiki-sec" style="margin:0">Hasil ${_contentModel?`<span style="font-weight:500;text-transform:none;color:var(--gray)">· ${_contentModel}</span>`:''}</div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="wikiCopy(_contentResult)">${svgIcon('note',13)} Salin</button>
        <button class="btn btn-ghost btn-sm" onclick="wikiDownload(_contentResult,'konten.md')">${svgIcon('download',13)} Download</button>
        <button class="btn btn-ghost btn-sm" onclick="useContentForImage()">${svgIcon('image',13)} Buat Gambar</button>
        <button class="btn btn-teal btn-sm" onclick="saveContent()">${svgIcon('check',13)} Simpan</button>
      </div>
    </div>
    <div class="wiki-out">${wikiMd(_contentResult)}</div>
  </div>`;
}

async function saveContent(){
  if(!_contentResult){ toast('Belum ada konten','warn'); return; }
  const V=i=>document.getElementById(i)?.value?.trim()||null;
  const title=(_contentResult.match(/^#\s+(.+)$/m)||[])[1] || (V('ct-topic')||'Konten').slice(0,80);
  try{
    await sbPost('wiki_contents',{ title, content_type:V('ct-type'), channel:V('ct-channel'),
      tone:V('ct-tone'), audience:V('ct-aud'), prompt:V('ct-topic'), body:_contentResult,
      status:'Draft', ai_model:_contentModel||null, created_by:wikiUser() });
    toast('✅ Konten disimpan','ok');
    await loadWikiContents(); renderWikiKPI(); renderWikiTab();
  }catch(e){ toast('❌ '+e.message,'err'); }
}
async function viewContent(id){
  const r=await sbGet('wiki_contents',`select=*&id=eq.${id}`).catch(()=>[]);
  const c=r?.[0]; if(!c) return;
  _wikiViewText=c.body||''; _wikiViewName=`${(c.title||'konten').replace(/[^\w]+/g,'_')}.md`;
  openModal(`<div class="modal-header"><div class="modal-title">${c.title||'Konten'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="font-size:11.5px;color:var(--gray);margin-bottom:8px">${c.content_type||''} · ${c.channel||''} · ${c.tone||''}</div>
    <div class="wiki-out">${wikiMd(_wikiViewText)}</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-outline btn-sm" onclick="wikiCopy(_wikiViewText)">Salin</button>
      <button class="btn btn-teal btn-sm" onclick="wikiDownload(_wikiViewText,_wikiViewName)">Download</button>
    </div>`,'wide');
}
async function deleteContent(id){
  if(!confirm('Hapus konten ini?')) return;
  try{ await sbDelete('wiki_contents',id); toast('Terhapus','warn');
    await loadWikiContents(); renderWikiKPI(); renderWikiTab(); }
  catch(e){ toast('❌ '+e.message,'err'); }
}
function useContentForImage(){
  const idea=(_contentResult.split(/##\s*Ide Visual/i)[1]||'').trim().split(/\n##/)[0].trim();
  switchWikiTab('media');
  setTimeout(()=>{ const p=document.getElementById('md-prompt');
    if(p){ p.value = idea || (_contentResult.match(/^#\s+(.+)$/m)||[])[1] || ''; p.focus(); } },60);
}

// ═══ MEDIA / GAMBAR ═══════════════════════════════════════════
let _mediaImages=[];
function renderWikiMediaTab(el){
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:340px 1fr;gap:14px;align-items:start">
      <div class="wiki-card">
        <div class="wiki-sec">Generate Gambar</div>
        <div class="form-group"><label>Deskripsi Gambar (prompt) *</label>
          <textarea id="md-prompt" rows="4" placeholder="mis. Perawat mengambil sampel darah pasien di klinik modern, pencahayaan lembut, bersih, profesional"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Gaya</label>
            <select id="md-style">${IMAGE_STYLES.map(s=>`<option>${s}</option>`).join('')}</select></div>
          <div class="form-group"><label>Rasio</label>
            <select id="md-ratio"><option>1:1 (feed)</option><option>4:5 (potrait)</option><option>16:9 (banner)</option><option>9:16 (story)</option></select></div>
        </div>
        <div class="form-group"><label>Judul (untuk disimpan)</label><input id="md-title" placeholder="Ilustrasi phlebotomy"></div>
        <button class="btn btn-teal" style="width:100%" id="md-run" onclick="runImageGen()">${svgIcon('sparkle',15)} Generate Gambar</button>
        <div style="font-size:11px;color:var(--gray);margin-top:8px">Hindari menyebut nama orang nyata/merek. Gambar dihasilkan AI.</div>
      </div>

      <div>
        <div id="md-output"></div>
        <div class="wiki-card" style="margin-top:14px">
          <div class="wiki-sec">Galeri Media (${wikiMedia.length})</div>
          ${wikiMedia.length?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">
            ${wikiMedia.slice(0,18).map(m=>`<div>
              <img class="wiki-thumb" src="${m.image_url}" alt="${m.title||''}" loading="lazy">
              <div style="font-size:10.5px;font-weight:600;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.title||'—'}</div>
              <div style="display:flex;gap:4px;margin-top:2px">
                <a class="act-btn" href="${m.image_url}" target="_blank" title="Buka">${svgIcon('eye',13)}</a>
                <button class="act-btn del" onclick="deleteMedia(${m.id})">${svgIcon('trash',13)}</button>
              </div></div>`).join('')}
          </div>`:`<div style="color:var(--gray);font-size:12px;padding:10px 0">Belum ada media.</div>`}
        </div>
      </div>
    </div>`;
  if(_mediaImages.length) renderMediaOutput();
}

async function runImageGen(){
  const p=document.getElementById('md-prompt')?.value.trim();
  if(!p){ toast('Deskripsi gambar wajib diisi','err'); return; }
  const style=document.getElementById('md-style')?.value||'';
  const ratio=(document.getElementById('md-ratio')?.value||'').split(' ')[0];
  const btn=document.getElementById('md-run'), out=document.getElementById('md-output');
  if(btn){ btn.disabled=true; btn.innerHTML='⏳ Menggambar...'; }
  out.innerHTML=`<div class="wiki-card"><div class="loading-row"><div class="spinner"></div> AI sedang membuat gambar…</div></div>`;
  try{
    const prompt=`${p}\n\nGaya: ${style}. Rasio aspek ${ratio}. Kualitas tinggi, komposisi bersih, cocok untuk materi promosi layanan kesehatan profesional. Tanpa teks/watermark di dalam gambar.`;
    const imgs=await wikiGenImage(prompt);
    _mediaImages=imgs;
    renderMediaOutput();
    toast('✅ Gambar dibuat','ok');
  }catch(e){
    out.innerHTML=`<div class="status-box status-err">❌ ${e.message}
      <div style="font-size:11.5px;margin-top:6px">Gambar <strong>100% NVIDIA</strong> — tulis bebas (Bahasa Indonesia pun otomatis diterjemahkan). <strong>Blokir prompt dinonaktifkan</strong>: bila filter NVIDIA menolak tema tertentu, sistem menulis-ulang prompt jadi versi aman lalu mencoba lagi otomatis. Kalau tetap gagal, itu penolakan di server NVIDIA (batasan tema medis-invasif pada orang), bukan sistem kita. Detail: <strong>Agentic AI → Monitor → Log LLM</strong>.</div></div>`;
  }
  if(btn){ btn.disabled=false; btn.innerHTML=`${svgIcon('sparkle',15)} Generate Gambar`; }
}

function renderMediaOutput(){
  const out=document.getElementById('md-output'); if(!out) return;
  out.innerHTML=`<div class="wiki-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="wiki-sec" style="margin:0">Hasil</div>
      <button class="btn btn-teal btn-sm" onclick="saveMedia()">${svgIcon('check',13)} Simpan ke Galeri</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${_mediaImages.map((src,i)=>`<div>
        <img src="${src}" style="width:100%;border-radius:8px;border:1px solid var(--border)">
        <a class="btn btn-ghost btn-sm" style="margin-top:6px;display:block;text-align:center" href="${src}" download="onelab_image_${i+1}.png">${svgIcon('download',13)} Download</a>
      </div>`).join('')}
    </div></div>`;
}

async function saveMedia(){
  if(!_mediaImages.length){ toast('Belum ada gambar','warn'); return; }
  const title=document.getElementById('md-title')?.value.trim() || 'Gambar AI';
  const prompt=document.getElementById('md-prompt')?.value.trim()||null;
  const style=document.getElementById('md-style')?.value||null;
  try{
    for(let i=0;i<_mediaImages.length;i++){
      const up=await wikiUploadDataUri(_mediaImages[i],'media',`${title.replace(/[^\w]+/g,'_')}_${Date.now()}_${i+1}.png`);
      await sbPost('wiki_media',{ title:_mediaImages.length>1?`${title} (${i+1})`:title, prompt, style,
        image_url:up.url, file_name:up.path.split('/').pop(), created_by:wikiUser() });
    }
    toast('✅ Gambar disimpan ke galeri','ok');
    _mediaImages=[];
    await loadWikiMedia(); renderWikiKPI(); renderWikiTab();
  }catch(e){ toast('❌ '+e.message,'err',6000); }
}
async function deleteMedia(id){
  if(!confirm('Hapus gambar ini dari galeri?')) return;
  try{ await sbDelete('wiki_media',id); toast('Terhapus','warn');
    await loadWikiMedia(); renderWikiKPI(); renderWikiTab(); }
  catch(e){ toast('❌ '+e.message,'err'); }
}
