/** Map scroll progress (0..1) to a frame index for a sequence of `frameCount` frames. */
export function frameForProgress(progress: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  const p = Math.min(1, Math.max(0, progress));
  return Math.min(frameCount - 1, Math.floor(p * frameCount));
}

/** Zero-padded frame file name, e.g. 7 → "007.webp". */
export function frameFile(index: number): string {
  return `${String(index + 1).padStart(3, '0')}.webp`;
}

/** Scroll progress of a tall wrapper: 0 when its top hits the viewport top, 1 when its bottom hits the viewport bottom. */
export function progressForRect(top: number, height: number, viewportHeight: number): number {
  const scrollable = height - viewportHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, -top / scrollable));
}

/** Order in which to preload frames: first, last, then a bisection so any scroll position finds a near frame quickly. */
export function preloadOrder(frameCount: number): number[] {
  if (frameCount <= 0) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  const push = (i: number) => {
    if (!seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  };
  push(0);
  push(frameCount - 1);
  let step = frameCount;
  while (step > 1) {
    step = Math.ceil(step / 2);
    for (let i = 0; i < frameCount; i += step) push(i);
  }
  for (let i = 0; i < frameCount; i++) push(i);
  return out;
}
