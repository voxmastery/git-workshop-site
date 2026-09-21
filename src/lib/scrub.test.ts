import { describe, expect, it } from 'vitest';
import { frameFile, frameForProgress, preloadOrder, progressForRect } from './scrub';

describe('frameForProgress', () => {
  it('clamps and maps evenly', () => {
    expect(frameForProgress(-1, 84)).toBe(0);
    expect(frameForProgress(0, 84)).toBe(0);
    expect(frameForProgress(0.5, 84)).toBe(42);
    expect(frameForProgress(1, 84)).toBe(83);
    expect(frameForProgress(2, 84)).toBe(83);
    expect(frameForProgress(0.5, 0)).toBe(0);
  });
});

describe('frameFile', () => {
  it('pads to three digits, one-based', () => {
    expect(frameFile(0)).toBe('001.webp');
    expect(frameFile(83)).toBe('084.webp');
  });
});

describe('progressForRect', () => {
  it('goes from 0 at the top to 1 at the bottom of the scroll range', () => {
    expect(progressForRect(0, 3000, 1000)).toBe(0);
    expect(progressForRect(-1000, 3000, 1000)).toBe(0.5);
    expect(progressForRect(-2000, 3000, 1000)).toBe(1);
    expect(progressForRect(-5000, 3000, 1000)).toBe(1);
    expect(progressForRect(200, 3000, 1000)).toBe(0);
    expect(progressForRect(0, 500, 1000)).toBe(1);
  });
});

describe('preloadOrder', () => {
  it('covers every frame exactly once, ends first and last', () => {
    const order = preloadOrder(10);
    expect(order.slice(0, 2)).toEqual([0, 9]);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(order).size).toBe(10);
    expect(preloadOrder(0)).toEqual([]);
  });
});
