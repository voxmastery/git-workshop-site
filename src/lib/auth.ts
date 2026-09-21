import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasSupabase, readEnv } from './env';

export type AuthUser = { email: string; name: string | null };

export interface AuthService {
  /** Current signed-in user, if any (resolves after the OAuth redirect is processed). */
  current(): Promise<AuthUser | null>;
  /** Start Google sign-in. With Supabase this redirects; the mock resolves immediately. */
  signInWithGoogle(hintEmail?: string): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  /** Access token for calling Edge Functions as the user. */
  accessToken(): Promise<string | null>;
}

const MOCK_KEY = 'cynergy-mock-user';

/** Mock: "signs in" as the email the visitor registered with, so the whole flow runs without a project. */
export class MockAuth implements AuthService {
  async current(): Promise<AuthUser | null> {
    try {
      const raw = localStorage.getItem(MOCK_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
  async signInWithGoogle(hintEmail?: string): Promise<AuthUser | null> {
    if (!hintEmail) return null;
    const user = { email: hintEmail.toLowerCase(), name: null };
    try {
      localStorage.setItem(MOCK_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 400));
    return user;
  }
  async signOut() {
    try {
      localStorage.removeItem(MOCK_KEY);
    } catch {
      /* ignore */
    }
  }
  async accessToken() {
    return null;
  }
}

export class SupabaseAuth implements AuthService {
  private client: SupabaseClient;
  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }
  async current(): Promise<AuthUser | null> {
    const { data } = await this.client.auth.getSession();
    const u = data.session?.user;
    if (!u?.email) return null;
    return { email: u.email.toLowerCase(), name: (u.user_metadata?.full_name as string | undefined) ?? null };
  }
  async signInWithGoogle(hintEmail?: string): Promise<AuthUser | null> {
    await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/`, queryParams: hintEmail ? { login_hint: hintEmail } : undefined },
    });
    return null; // page redirects
  }
  async signOut() {
    await this.client.auth.signOut();
  }
  async accessToken() {
    const { data } = await this.client.auth.getSession();
    return data.session?.access_token ?? null;
  }
}

export function createAuth(): AuthService {
  const env = readEnv();
  if (hasSupabase(env)) return new SupabaseAuth(env.supabaseUrl!, env.supabaseAnonKey!);
  return new MockAuth();
}
