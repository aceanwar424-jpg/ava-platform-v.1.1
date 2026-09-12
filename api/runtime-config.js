// Konfigurasi publik runtime untuk static site Vercel.
// Jangan pernah menaruh service-role, secret SATUSEHAT, atau private key di sini.
module.exports = (request, response) => {
  const config = {
    supabaseUrl: process.env.AVA_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.AVA_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  };
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).send('Runtime configuration unavailable');
  }
  // A misconfigured server secret must never become browser configuration.
  let publicKey = config.supabaseAnonKey.startsWith('sb_publishable_');
  try {
    publicKey ||= JSON.parse(Buffer.from(config.supabaseAnonKey.split('.')[1] || '', 'base64url').toString()).role === 'anon';
  } catch (_) {}
  if (config.supabaseAnonKey && !publicKey) {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).send('Runtime configuration unavailable');
  }
  response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).send(`window.AVA_RUNTIME_CONFIG = ${JSON.stringify(config)};`);
};
