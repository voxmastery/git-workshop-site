import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { randomToken, sha256Hex, signTicket, verifyTicket } from './token.ts';

Deno.test('sign and verify round-trip', async () => {
  const sig = await signTicket(42, 'secret');
  assertEquals(sig.length, 64);
  assertEquals(await verifyTicket(42, sig, 'secret'), true);
  assertEquals(await verifyTicket(43, sig, 'secret'), false);
  assertEquals(await verifyTicket(42, sig, 'other'), false);
});

Deno.test('random token is 64 hex chars and unique', () => {
  const a = randomToken();
  assertEquals(a.length, 64);
  assertNotEquals(a, randomToken());
});

Deno.test('sha256 is stable', async () => {
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
