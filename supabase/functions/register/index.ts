import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, json, randomToken, sha256Hex, signTicket } from '../_shared/token.ts';

const DEPARTMENTS = ['CSE', 'AI/ML', 'ISE', 'ECE', 'EEE', 'ME', 'Civil', 'Other'];
const YEARS = ['1st', '2nd', '3rd', '4th'];

type Body = {
  name?: string;
  email?: string;
  department?: string;
  classYear?: string;
  phone?: string;
  githubUsername?: string;
};

function validate(b: Body): string | null {
  const name = (b.name ?? '').trim();
  if (name.length < 2 || name.length > 60) return 'name';
  const email = (b.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@gmail\.com$/.test(email)) return 'email';
  if (!DEPARTMENTS.includes(b.department ?? '')) return 'department';
  if (!YEARS.includes(b.classYear ?? '')) return 'classYear';
  if (!/^[0-9]{10}$/.test((b.phone ?? '').replace(/\s+/g, ''))) return 'phone';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: 'json' });
  }
  const bad = validate(body);
  if (bad) return json(400, { error: `invalid_${bad}` });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 5 attempts per IP per 10 minutes
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase.from('register_attempts').select('*', { count: 'exact', head: true }).eq('ip', ip).gte('attempted_at', since);
  if ((count ?? 0) >= 5) return json(429, { error: 'rate_limited' });
  await supabase.from('register_attempts').insert({ ip });

  const secret = Deno.env.get('TICKET_HMAC_SECRET');
  if (!secret) return json(500, { error: 'server_config' });
  const token = randomToken();

  const { data, error } = await supabase
    .from('registrations')
    .insert({
      name: body.name!.trim(),
      email: body.email!.trim().toLowerCase(),
      department: body.department,
      class_year: body.classYear,
      phone: body.phone!.replace(/\s+/g, ''),
      github_username: body.githubUsername?.trim() || null,
      checkin_token_hash: await sha256Hex(token),
    })
    .select('ticket_no')
    .single();

  if (error) {
    if (error.code === '23505') return json(409, { error: 'duplicate' });
    console.error(error);
    return json(500, { error: 'insert' });
  }
  const ticketNo = data.ticket_no as number;
  const site = Deno.env.get('SITE_URL') ?? 'https://git-workshop-site.vercel.app';
  return json(201, { ticketNo, qrUrl: `${site}/c/${ticketNo}.${await signTicket(ticketNo, secret)}` });
});
