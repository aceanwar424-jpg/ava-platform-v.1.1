// Local-only synthetic UI fixture. This file is outside the deployment directory.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../ava-platform');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json' };
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let filename = path.resolve(root, '.' + url.pathname);
  if (!filename.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) { res.writeHead(404); res.end(); return; }
  let content = fs.readFileSync(filename);
  if (url.pathname === '/apps/index.html') {
    content = content.toString().replace(/<script[\s\S]*?<\/script>/g, '');
    content = content.replace('</body>', `<script>
      const SUPABASE_URL = 'http://127.0.0.1:5185/blocked'; const SUPABASE_RUNTIME_KEY = 'synthetic'; const SB_HEADERS = {};
      window.fetch = async () => { if (new URLSearchParams(location.search).get('mode') === 'error') throw new TypeError('Synthetic offline'); return { ok:true, json:async()=>[] }; };
      let syntheticWellnessConsent = new URLSearchParams(location.search).get('consent') !== 'pending';
      async function sbGet(){return []}
      async function sbRpc(name){
        if(name==='wellness_accept_consent'){ syntheticWellnessConsent = true; return {ok:true,consent_status:'granted'}; }
        if(name==='wellness_personal_dashboard') return {programs:[{id:'synthetic-program',name:'Program Kardiometabolik',description:'Program uji sintetis',enrollment_status:'active',consent_status:syntheticWellnessConsent?'granted':'pending'}],observations:syntheticWellnessConsent?[{id:'o1',program_id:'synthetic-program',group_id:'g1',code:'blood_pressure_systolic',value:120,unit:'mmHg',measurement_context:'resting',measured_at:'2026-09-22T08:00:00+07:00',source:'self_reported',verification_status:'unverified'},{id:'o2',program_id:'synthetic-program',group_id:'g1',code:'blood_pressure_diastolic',value:80,unit:'mmHg',measurement_context:'resting',measured_at:'2026-09-22T08:00:00+07:00',source:'self_reported',verification_status:'unverified'}]:[],open_tasks:[]};
        if(name==='wellness_corporate_dashboard') return {privacy_mode:'aggregate_only',small_cell_threshold:5,programs:[{id:'synthetic-program',code:'SYN-CARDIO',name:'Program Kardiometabolik',description:'Cohort uji sintetis',status:'pilot',enrolled:24,linked_accounts:20,active_7d:18,measurements_30d:96,bp_coverage_30d:16,glucose_coverage_30d:12,avg_systolic_30d:122,avg_diastolic_30d:81,avg_glucose_30d:108}]};
        if(name==='wellness_admin_dashboard') return {corporates:[{id:10,name:'Synthetic Corporate'}],programs:[{id:'synthetic-program',corporate_id:10,code:'SYN-CARDIO',name:'Program Kardiometabolik',description:'Cohort uji sintetis',corporate_name:'Synthetic Corporate',status:'pilot',starts_on:'2026-09-22',ends_on:'2026-12-31',measurement_plan:{blood_pressure:'daily',blood_glucose:'custom'},enrolled:24,observations:96,open_tasks:3}],reminder_rules:[],imports:[]};
        return [];
      }
      async function sbPost(){throw new Error('Writes disabled in UI fixture')}
      async function sbPatch(){throw new Error('Writes disabled in UI fixture')}
      async function sbDelete(){throw new Error('Writes disabled in UI fixture')}
    </script><script src="navigation.js"></script><script src="app.js"></script><script src="wellness.js"></script><script>
    document.addEventListener('DOMContentLoaded', () => {
      const role = new URLSearchParams(location.search).get('role') || 'patient';
      currentRole = PORTAL_ROLES.includes(role) ? role : 'patient';
      currentUsername = 'Pengguna Uji'; currentUserEmail = 'synthetic@example.invalid';
      currentUserProfile = {id:'synthetic-user',full_name:currentUsername,role:currentRole};
      currentCorpRole = 'requestor'; currentCorporateId = currentRole === 'corporate' ? 'synthetic-corp' : null;
      renderSidebarMenu(); showScreen('dashboard-screen');
      const requestedView = new URLSearchParams(location.search).get('view');
      if(requestedView) showView(requestedView);
      else if(currentRole === 'tech' || currentRole === 'referral') showView('profile-view');
    });</script></body>`);
  }
  res.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(content);
}).listen(5185,'127.0.0.1',()=>console.log('Synthetic Apps fixture http://127.0.0.1:5185/apps/index.html'));
