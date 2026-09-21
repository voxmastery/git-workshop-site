export const STUB_COLOURS = ['#f05033', '#8957e5', '#3ddc84', '#ff7a59', '#5a45a0'] as const;
export const STICKERS = ['pull-request', 'merge', 'fork', 'star', 'octocat', 'git'] as const;

export type TicketLayout = {
  stubColour: (typeof STUB_COLOURS)[number];
  stickers: (typeof STICKERS)[number][];
  tilt: number; // degrees, small
};

/** Deterministic small hash so the same ticket number always renders the same way. */
export function hashTicket(ticketNo: number): number {
  let h = 2166136261 ^ ticketNo;
  h = Math.imul(h, 16777619) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

export function layoutForTicket(ticketNo: number): TicketLayout {
  const h = hashTicket(ticketNo);
  const stubColour = STUB_COLOURS[h % STUB_COLOURS.length];
  const start = (h >>> 8) % STICKERS.length;
  const stickers = Array.from({ length: 4 }, (_, i) => STICKERS[(start + i) % STICKERS.length]);
  const tilt = ((h >>> 16) % 7) - 3; // -3..3
  return { stubColour, stickers, tilt };
}
