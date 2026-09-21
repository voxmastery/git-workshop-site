import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, json, signTicket } from '../_shared/token.ts';

/**
 * POST { email, lookupOnly? } with the user's JWT.
 * Binds the signed-in Google account to the registration whose email matches the JWT email
 * (the body email must equal it too), or just returns it when lookupOnly is true.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'unauthenticated' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: userData, error: userErr } = await anon.auth.getUser();
  if (userErr || !userData.user?.email) return json(401, { error: 'unauthenticated' });
  const jwtEmail = userData.user.email.toLowerCase();

  let body: { email?: string; lookupOnly?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body allowed */
  }
  if (body.email && body.email.toLowerCase() !== jwtEmail) return json(403, { error: 'email_mismatch' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: row } = await admin.from('registrations').select('*').eq('email', jwtEmail).maybeSingle();
  if (!row) return json(404, { error: 'no_match' });

  if (!body.lookupOnly && row.google_uid !== userData.user.id) {
    const { error } = await admin.from('registrations').update({ google_uid: userData.user.id }).eq('id', row.id);
    if (error) return json(409, { error: 'already_bound' });
    row.google_uid = userData.user.id;
  }

  const secret = Deno.env.get('TICKET_HMAC_SECRET') ?? '';
  const site = Deno.env.get('SITE_URL') ?? 'https://git-workshop-site.vercel.app';
  return json(200, {
    registration: {
      ticketNo: row.ticket_no,
      name: row.name,
      email: row.email,
      department: row.department,
      classYear: row.class_year,
      phone: row.phone,
      githubUsername: row.github_username,
      qrUrl: `${site}/c/${row.ticket_no}.${await signTicket(row.ticket_no, secret)}`,
      savedToEmail: row.google_uid ? row.email : null,
    },
  });
});
