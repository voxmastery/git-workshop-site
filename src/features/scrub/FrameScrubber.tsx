import { useEffect, useRef } from 'react';
import { frameFile, frameForProgress, preloadOrder } from '../../lib/scrub';

type Props = {
  /** 0..1 scroll progress */
  progress: number;
  frameCount: number;
  basePath: string; // e.g. "/frames/ticket"
  width: number; // intrinsic frame size
  height: number;
  className?: string;
};

/** Draws the frame for `progress` on a canvas, preloading frames in bisection order so scrubbing never waits long. */
export function FrameScrubber({ progress, frameCount, basePath, width, height, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  const lastDrawn = useRef<number>(-1);

  useEffect(() => {
    images.current = Array.from({ length: frameCount }, () => null);
    let cancelled = false;
    const order = preloadOrder(frameCount);
    let i = 0;
    const loadNext = () => {
      if (cancelled || i >= order.length) return;
      const idx = order[i++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        images.current[idx] = img;
        if (idx === frameForProgress(progressRef.current, frameCount)) draw(progressRef.current);
        loadNext();
      };
      img.onerror = loadNext;
      img.src = `${basePath}/${frameFile(idx)}`;
    };
    // three parallel loaders
    loadNext();
    loadNext();
    loadNext();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, frameCount]);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  function draw(p: number) {
    const c = canvas.current;
    if (!c) return;
    const idx = frameForProgress(p, frameCount);
    // nearest loaded frame at or below idx, else above
    let img: HTMLImageElement | null = null;
    for (let d = 0; d < frameCount && !img; d++) {
      img = images.current[idx - d] ?? images.current[idx + d] ?? null;
    }
    if (!img) return;
    if (lastDrawn.current === idx && img === images.current[idx]) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    lastDrawn.current = idx;
  }

  useEffect(() => {
    let raf = requestAnimationFrame(() => draw(progress));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  return <canvas ref={canvas} width={width} height={height} className={className} aria-hidden="true" />;
}
