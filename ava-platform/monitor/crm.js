/* OWNED_BY: generic. Uses existing tenant-authorized CRM RPC; never synthetic live data. */
(() => {
 const byId=id=>document.getElementById(id);
 const today=new Date(),start=new Date(today.getFullYear(),today.getMonth(),1);
 const date=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 byId('crm-from').value=date(start);byId('crm-to').value=date(today);
 const money=v=>Number.isFinite(Number(v))&&v!==null&&v!==undefined?new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)):'Belum tersedia';
 const count=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
 async function refresh(event){
  event?.preventDefault();const from=byId('crm-from').value,to=byId('crm-to').value;
  const result=byId('crm-results'),message=byId('crm-message'),state=byId('crm-state'),button=document.querySelector('#crm-period button');
  result.hidden=true;result.replaceChildren();
  if(!from||!to||from>to){state.textContent='Periode tidak valid';message.textContent='Tanggal mulai harus sama atau lebih awal dari tanggal akhir.';return;}
  if(typeof sbAccessToken!=='function'||!sbAccessToken()){state.textContent='Perlu sesi CRM';message.textContent='Ringkasan belum tersedia di sesi ini. Buka workspace CRM dengan akun berwenang untuk melihat data. Tidak ada angka contoh yang ditampilkan.';return;}
  button.disabled=true;state.textContent='Memuat';message.textContent='Mengambil ringkasan periode terpilih…';
  try{
   const response=await sbRpc('crm_funnel_summary',{p_from:from,p_to:to});const f=Array.isArray(response)?response[0]:response;
   if(!f||typeof f!=='object')throw Error('Missing summary');
   const rows=[['Leads masuk',count(f.total_leads)],['Deal',count(f.total_deals)],['Partner aktif',count(f.total_partners)],['Partner dengan faktur',count(f.partners_with_revenue??f.total_invoiced)]];
   if(rows.every(r=>r[1]===null))throw Error('Invalid summary');
   const max=Math.max(...rows.map(r=>r[1]??0),1);
   // Only numeric data is interpolated. Source strings are never interpreted as HTML.
   result.innerHTML='<section class="panel"><h2>Corong penjualan</h2><p style="margin-top:8px">Jumlah per tahap, bukan persentase pendapatan. Nilai tertulis di samping setiap batang.</p><ul class="crm-chart">'+rows.map(([label,n])=>'<li><span>'+label+'</span><span class="crm-track" aria-hidden="true"><i style="width:'+((n??0)/max*100)+'%"></i></span><strong>'+(n===null?'Belum tersedia':n.toLocaleString('id-ID'))+'</strong></li>').join('')+'</ul></section><section class="crm-financial"><article class="panel"><h2>Nilai pipeline</h2><strong>'+money(f.pipeline_value)+'</strong><small>Perkiraan yang dicatat tim sales.</small></article><article class="panel"><h2>Pendapatan tercatat</h2><strong>'+money(f.revenue_actual??f.total_revenue)+'</strong><small>Berdasarkan ringkasan faktur pada periode terpilih.</small></article></section>';
   result.hidden=false;state.textContent='Data termuat';message.textContent='Periode '+from+' sampai '+to+' · diperbarui '+new Date().toLocaleTimeString('id-ID')+'.';
  }catch(_){state.textContent='Gagal memuat';message.textContent='Data belum dapat dimuat. Periksa sesi dan koneksi, lalu pilih Perbarui ringkasan. Data lama tidak ditampilkan sebagai data terkini.';}
  finally{button.disabled=false;}
 }
 byId('crm-period').addEventListener('submit',refresh);refresh();
})();
