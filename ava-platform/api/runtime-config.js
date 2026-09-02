// Konfigurasi publik runtime untuk static site Vercel.
// Jangan pernah menaruh service-role, secret SATUSEHAT, atau private key di sini.
module.exports = (request, response) => {
  const config = {
    supabaseUrl: process.env.AVA_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.AVA_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  };
  response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).send(`window.AVA_RUNTIME_CONFIG = ${JSON.stringify(config)};`);
};
