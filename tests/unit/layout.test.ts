import { getAspectRatio, scaledSize } from '../../remotion/utils/layout';

describe('getAspectRatio', () => {
  it('returns 9:16 for portrait video (1080x1920)', () => {
    expect(getAspectRatio(1080, 1920)).toBe('9:16');
  });

  it('returns 16:9 for landscape video (1920x1080)', () => {
    expect(getAspectRatio(1920, 1080)).toBe('16:9');
  });

  it('returns 1:1 for square video (1080x1080)', () => {
    expect(getAspectRatio(1080, 1080)).toBe('1:1');
  });

  it('returns other for non-standard aspect ratios', () => {
    expect(getAspectRatio(1280, 720)).toBe('16:9');
    expect(getAspectRatio(720, 1280)).toBe('9:16');
    expect(getAspectRatio(800, 600)).toBe('other');
  });

  it('returns 1:1 within 5% tolerance (1100x1080)', () => {
    expect(getAspectRatio(1100, 1080)).toBe('1:1');
  });

  it('treats ratio < 0.6 as 9:16', () => {
    expect(getAspectRatio(540, 960)).toBe('9:16');
  });
});

describe('scaledSize', () => {
  it('scales relative to the short edge', () => {
    expect(scaledSize(0.03, 1080, 1920)).toBeCloseTo(32.4);
    expect(scaledSize(0.03, 1920, 1080)).toBeCloseTo(32.4);
    expect(scaledSize(0.03, 1080, 1080)).toBeCloseTo(32.4);
  });

  it('returns base * min(width, height)', () => {
    expect(scaledSize(0.1, 200, 400)).toBeCloseTo(20);
    expect(scaledSize(0.067, 1080, 1920)).toBeCloseTo(72.36);
  });

  it('handles zero base', () => {
    expect(scaledSize(0, 1080, 1920)).toBe(0);
  });
});
