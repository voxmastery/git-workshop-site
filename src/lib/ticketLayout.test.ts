import { describe, expect, it } from 'vitest';
import { STICKERS, STUB_COLOURS, layoutForTicket } from './ticketLayout';

describe('layoutForTicket', () => {
  it('is deterministic and within bounds', () => {
    for (const n of [1, 2, 57, 999]) {
      const a = layoutForTicket(n);
      expect(a).toEqual(layoutForTicket(n));
      expect(STUB_COLOURS).toContain(a.stubColour);
      expect(a.stickers).toHaveLength(4);
      a.stickers.forEach((s) => expect(STICKERS).toContain(s));
      expect(a.tilt).toBeGreaterThanOrEqual(-3);
      expect(a.tilt).toBeLessThanOrEqual(3);
    }
  });
  it('varies between neighbouring tickets', () => {
    const variants = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(layoutForTicket(i + 1))));
    expect(variants.size).toBeGreaterThan(5);
  });
});
