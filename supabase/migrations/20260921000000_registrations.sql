create sequence if not exists ticket_no_seq start 1;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  ticket_no int not null unique default nextval('ticket_no_seq'),
  name text not null check (char_length(name) between 2 and 60),
  email text not null unique check (email = lower(email) and email like '%@gmail.com'),
  department text not null check (department in ('CSE','AI/ML','ISE','ECE','EEE','ME','Civil','Other')),
  class_year text not null check (class_year in ('1st','2nd','3rd','4th')),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  github_username text,
  laptop boolean not null default true,
  os text,
  google_uid uuid unique,
  checkin_token_hash text not null,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz
);

create table if not exists public.organisers (
  email text primary key
);

create table if not exists public.register_attempts (
  ip text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists register_attempts_ip_idx on public.register_attempts (ip, attempted_at);

alter table public.registrations enable row level security;
alter table public.organisers enable row level security;
alter table public.register_attempts enable row level security;

-- Only the service role (Edge Functions) writes. Signed-in users read their own row.
create policy "own row" on public.registrations
  for select to authenticated
  using (google_uid = auth.uid() or email = lower(auth.jwt() ->> 'email'));

create policy "organisers read all" on public.registrations
  for select to authenticated
  using (exists (select 1 from public.organisers o where o.email = lower(auth.jwt() ->> 'email')));

create policy "organisers see themselves" on public.organisers
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
