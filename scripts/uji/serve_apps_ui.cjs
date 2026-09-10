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
      async function sbGet(){return []} async function sbRpc(){return []}
      async function sbPost(){throw new Error('Writes disabled in UI fixture')}
      async function sbPatch(){throw new Error('Writes disabled in UI fixture')}
      async function sbDelete(){throw new Error('Writes disabled in UI fixture')}
    </script><script src="navigation.js"></script><script src="app.js"></script><script>
    document.addEventListener('DOMContentLoaded', () => {
      const role = new URLSearchParams(location.search).get('role') || 'patient';
      currentRole = PORTAL_ROLES.includes(role) ? role : 'patient';
      currentUsername = 'Pengguna Uji'; currentUserEmail = 'synthetic@example.invalid';
      currentUserProfile = {id:'synthetic-user',full_name:currentUsername,role:currentRole};
      currentCorpRole = 'requestor'; currentCorporateId = currentRole === 'corporate' ? 'synthetic-corp' : null;
      renderSidebarMenu(); showScreen('dashboard-screen');
      if(currentRole === 'tech' || currentRole === 'referral') showView('profile-view');
    });</script></body>`);
  }
  res.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(content);
}).listen(5185,'127.0.0.1',()=>console.log('Synthetic Apps fixture http://127.0.0.1:5185/apps/index.html'));
