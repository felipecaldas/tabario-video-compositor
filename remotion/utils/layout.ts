export type AspectRatio = '9:16' | '16:9' | '1:1' | 'other';

export function getAspectRatio(width: number, height: number): AspectRatio {
  const r = width / height;
  if (r < 0.6) return '9:16';
  if (r > 1.6) return '16:9';
  if (Math.abs(r - 1) < 0.05) return '1:1';
  return 'other';
}

/** Returns base * Math.min(width, height). Express base as a fraction, e.g. 0.03 = 3% of short edge. */
export function scaledSize(base: number, width: number, height: number): number {
  return base * Math.min(width, height);
}
