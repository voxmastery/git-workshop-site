export type AppEnv = {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  organiserEmails: string[];
};

export function readEnv(): AppEnv {
  const e = import.meta.env as Record<string, string | undefined>;
  return {
    supabaseUrl: e.VITE_SUPABASE_URL || null,
    supabaseAnonKey: e.VITE_SUPABASE_ANON_KEY || null,
    organiserEmails: (e.VITE_ORGANISER_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function hasSupabase(env: AppEnv = readEnv()): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
