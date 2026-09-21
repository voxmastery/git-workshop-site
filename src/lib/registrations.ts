import type { RegistrationInput } from './validation';
import { normaliseEmail } from './validation';

export type RegistrationResult = { ticketNo: number };

export interface RegistrationBackend {
  register(input: RegistrationInput): Promise<RegistrationResult>;
}

/** Local mock used until VITE_SUPABASE_URL is configured. Keeps state in localStorage. */
class LocalMockBackend implements RegistrationBackend {
  private key = 'cynergy-registrations';

  private read(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  async register(input: RegistrationInput): Promise<RegistrationResult> {
    const rows = this.read();
    const email = normaliseEmail(input.email);
    if (rows[email]) throw new Error('This Gmail already has a ticket. Sign in to see it.');
    const ticketNo = Object.keys(rows).length + 1;
    const next = { ...rows, [email]: ticketNo };
    try {
      localStorage.setItem(this.key, JSON.stringify(next));
    } catch {
      /* private mode: still return a ticket */
    }
    await new Promise((r) => setTimeout(r, 600));
    return { ticketNo };
  }
}

export function createBackend(): RegistrationBackend {
  // Supabase adapter lands in phase 2; the URL check keeps the switch in one place.
  return new LocalMockBackend();
}
