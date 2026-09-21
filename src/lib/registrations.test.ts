import { describe, expect, it, vi } from 'vitest';
import { SupabaseBackend, mapRegisterError } from './registrations';
import { EMPTY_REGISTRATION } from './validation';

const input = { ...EMPTY_REGISTRATION, name: 'Asha Rao', email: 'Asha@gmail.com', department: 'CSE', classYear: '2nd', phone: '98765 43210' };

describe('SupabaseBackend.register', () => {
  it('posts normalised data to the register function and returns the ticket', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ticketNo: 12, qrUrl: 'https://x/c/12.abc' }), { status: 201 }));
    const b = new SupabaseBackend('https://proj.supabase.co/', 'anon', fetchImpl as unknown as typeof fetch);
    const reg = await b.register(input);
    expect(reg.ticketNo).toBe(12);
    expect(reg.qrUrl).toBe('https://x/c/12.abc');
    expect(reg.email).toBe('asha@gmail.com');
    expect(reg.phone).toBe('9876543210');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://proj.supabase.co/functions/v1/register');
    expect((init.headers as Record<string, string>).apikey).toBe('anon');
    expect(JSON.parse(init.body as string).email).toBe('asha@gmail.com');
  });

  it('turns a 409 into the duplicate message', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'duplicate' }), { status: 409 }));
    const b = new SupabaseBackend('https://proj.supabase.co', 'anon', fetchImpl as unknown as typeof fetch);
    await expect(b.register(input)).rejects.toThrow('already has a ticket');
  });

  it('claim requires a session token and maps 404 to NO_MATCH', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 404 }));
    const noSession = new SupabaseBackend('https://p.supabase.co', 'anon', fetchImpl as unknown as typeof fetch);
    await expect(noSession.claim('a@gmail.com')).rejects.toThrow('NOT_SIGNED_IN');
    const withSession = new SupabaseBackend('https://p.supabase.co', 'anon', fetchImpl as unknown as typeof fetch, async () => 'jwt');
    await expect(withSession.claim('a@gmail.com')).rejects.toThrow('NO_MATCH');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
  });
});

describe('mapRegisterError', () => {
  it('maps known errors to friendly copy', () => {
    expect(mapRegisterError(409, { error: 'duplicate' })).toMatch(/already has a ticket/);
    expect(mapRegisterError(429, { error: 'rate_limited' })).toMatch(/Too many tries/);
    expect(mapRegisterError(400, { error: 'invalid_email' })).toMatch(/Gmail/);
    expect(mapRegisterError(500, {})).toMatch(/try again/);
  });
});
