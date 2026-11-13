import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Login is temporarily unavailable.' }, 503);

  let identifier = '';
  let password = '';
  try {
    const body = await req.json();
    identifier = typeof body.identifier === 'string' ? body.identifier.trim().slice(0, 120) : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch { return json({ error: 'Enter your ID and password.' }, 400); }
  if (!identifier || !password || password.length > 1024) return json({ error: 'Enter your ID and password.' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateKeys = await Promise.all([sha256(`username-login-ip:${ip}`), sha256(`username-login-id:${identifier.toLowerCase()}`)]);
  const limited = await Promise.all(rateKeys.map((key) => admin.rpc('check_student_login_rate_limit', {
    p_rate_key: key, p_max_attempts: 8, p_window_seconds: 900,
  })));
  if (limited.some(({ error, data }) => error || data !== true)) return json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' }, 429);

  const { data: email, error: lookupError } = await admin.rpc('resolve_student_login_email', { p_identifier: identifier });
  const resolvedEmail = identifier.includes('@') ? identifier : (typeof email === 'string' ? email : null);
  if ((lookupError && !identifier.includes('@')) || typeof resolvedEmail !== 'string') {
    return json({ error: 'Invalid ID or password. Check your details and try again.' });
  }

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email: resolvedEmail, password });
  if (error || !data.session || !data.user) return json({ error: 'Invalid ID or password. Check your details and try again.' });
  return json({ session: data.session, user: data.user });
});
