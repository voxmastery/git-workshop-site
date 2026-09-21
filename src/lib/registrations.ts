import { hasSupabase, readEnv } from './env';
import type { RegistrationInput } from './validation';
import { normaliseEmail } from './validation';

export type Registration = {
  ticketNo: number;
  name: string;
  email: string;
  department: string;
  classYear: string;
  phone: string;
  githubUsername: string | null;
  qrUrl: string;
  savedToEmail: string | null; // set once the Google account is bound
};

export interface RegistrationBackend {
  /** Create the registration; returns the ticket. */
  register(input: RegistrationInput): Promise<Registration>;
  /** Bind the signed-in Google account (by email) to its registration and return it. */
  claim(email: string): Promise<Registration>;
  /** Fetch the registration owned by the signed-in account, if any. */
  mine(email: string): Promise<Registration | null>;
}

export function mapRegisterError(status: number, body: { error?: string }): string {
  if (status === 409) return 'This Gmail already has a ticket. Sign in with it to see the ticket.';
  if (status === 429) return 'Too many tries from this network. Wait a few minutes and try again.';
  if (status === 400 && body.error === 'invalid_email') return 'Use a personal Gmail address ending in @gmail.com.';
  if (status === 400) return 'Something in the form isn’t right. Check the fields and try again.';
  return 'Something went wrong. Please try again.';
}

const MOCK_KEY = 'cynergy-registrations-v2';

type MockStore = Record<string, Registration>;

function readMock(): MockStore {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) ?? '{}') as MockStore;
  } catch {
    return {};
  }
}
function writeMock(store: MockStore) {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

/** Local mock used until Supabase env vars exist. Whole flow works offline. */
export class LocalMockBackend implements RegistrationBackend {
  async register(input: RegistrationInput): Promise<Registration> {
    const store = readMock();
    const email = normaliseEmail(input.email);
    if (store[email]) throw new Error(mapRegisterError(409, {}));
    const ticketNo = Object.keys(store).length + 1;
    const reg: Registration = {
      ticketNo,
      name: input.name.trim(),
      email,
      department: input.department,
      classYear: input.classYear,
      phone: input.phone.replace(/\s+/g, ''),
      githubUsername: input.noGithubYet ? null : input.githubUsername.trim() || null,
      qrUrl: `${location.origin}/c/${ticketNo}.mock`,
      savedToEmail: null,
    };
    writeMock({ ...store, [email]: reg });
    await new Promise((r) => setTimeout(r, 500));
    return reg;
  }
  async claim(email: string): Promise<Registration> {
    const store = readMock();
    const reg = store[normaliseEmail(email)];
    if (!reg) throw new Error('NO_MATCH');
    const bound = { ...reg, savedToEmail: normaliseEmail(email) };
    writeMock({ ...store, [bound.email]: bound });
    return bound;
  }
  async mine(email: string): Promise<Registration | null> {
    return readMock()[normaliseEmail(email)] ?? null;
  }
}

type RegisterResponse = { ticketNo?: number; qrUrl?: string; error?: string };

/** Talks to the Supabase `register` Edge Function and the `registrations` table (RLS: own row only). */
export class SupabaseBackend implements RegistrationBackend {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly accessToken: () => Promise<string | null>;

  constructor(url: string, anonKey: string, fetchImpl?: typeof fetch, accessToken?: () => Promise<string | null>) {
    this.url = url;
    this.anonKey = anonKey;
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
    this.accessToken = accessToken ?? (async () => null);
  }

  private endpoint(path: string) {
    return `${this.url.replace(/\/$/, '')}${path}`;
  }

  async register(input: RegistrationInput): Promise<Registration> {
    const res = await this.fetchImpl(this.endpoint('/functions/v1/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}` },
      body: JSON.stringify({
        name: input.name.trim(),
        email: normaliseEmail(input.email),
        department: input.department,
        classYear: input.classYear,
        phone: input.phone.replace(/\s+/g, ''),
        githubUsername: input.noGithubYet ? '' : input.githubUsername.trim(),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as RegisterResponse;
    if (!res.ok || typeof body.ticketNo !== 'number' || !body.qrUrl) throw new Error(mapRegisterError(res.status, body));
    return {
      ticketNo: body.ticketNo,
      name: input.name.trim(),
      email: normaliseEmail(input.email),
      department: input.department,
      classYear: input.classYear,
      phone: input.phone.replace(/\s+/g, ''),
      githubUsername: input.noGithubYet ? null : input.githubUsername.trim() || null,
      qrUrl: body.qrUrl,
      savedToEmail: null,
    };
  }

  private async authed(path: string, init: RequestInit = {}) {
    const token = await this.accessToken();
    if (!token) throw new Error('NOT_SIGNED_IN');
    return this.fetchImpl(this.endpoint(path), {
      ...init,
      headers: { ...(init.headers as Record<string, string>), apikey: this.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  }

  async claim(email: string): Promise<Registration> {
    const res = await this.authed('/functions/v1/claim', { method: 'POST', body: JSON.stringify({ email: normaliseEmail(email) }) });
    const body = (await res.json().catch(() => ({}))) as { registration?: Registration; error?: string };
    if (res.status === 404) throw new Error('NO_MATCH');
    if (!res.ok || !body.registration) throw new Error(body.error ?? 'claim_failed');
    return body.registration;
  }

  async mine(email: string): Promise<Registration | null> {
    const res = await this.authed('/functions/v1/claim', { method: 'POST', body: JSON.stringify({ email: normaliseEmail(email), lookupOnly: true }) });
    if (res.status === 404) return null;
    const body = (await res.json().catch(() => ({}))) as { registration?: Registration };
    return res.ok && body.registration ? body.registration : null;
  }
}

export function createBackend(accessToken?: () => Promise<string | null>): RegistrationBackend {
  const env = readEnv();
  if (hasSupabase(env)) return new SupabaseBackend(env.supabaseUrl!, env.supabaseAnonKey!, undefined, accessToken);
  return new LocalMockBackend();
}
