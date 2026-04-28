import { vSize, safeZone, fitText } from '../../remotion/utils/typography';

describe('vSize', () => {
  it('scales relative to the short edge in portrait (1080x1920)', () => {
    expect(vSize(0.09, { width: 1080, height: 1920 })).toBeCloseTo(97.2);
  });

  it('scales relative to the short edge in landscape (1920x1080)', () => {
    expect(vSize(0.09, { width: 1920, height: 1080 })).toBeCloseTo(97.2);
  });

  it('scales relative to the short edge in square (1080x1080)', () => {
    expect(vSize(0.09, { width: 1080, height: 1080 })).toBeCloseTo(97.2);
  });

  it('returns base * min(width, height)', () => {
    expect(vSize(0.067, { width: 1080, height: 1920 })).toBeCloseTo(72.36);
  });

  it('handles zero scale', () => {
    expect(vSize(0, { width: 1080, height: 1920 })).toBe(0);
  });
});

describe('safeZone', () => {
  it('gives tiktok a bottom inset of ≥ 20%', () => {
    expect(safeZone('tiktok').bottom).toBeGreaterThanOrEqual(0.20);
  });

  it('gives instagram a bottom inset of ≥ 20%', () => {
    expect(safeZone('instagram').bottom).toBeGreaterThanOrEqual(0.20);
  });

  it('gives yt_shorts a smaller bottom inset than tiktok', () => {
    expect(safeZone('yt_shorts').bottom).toBeLessThan(safeZone('tiktok').bottom);
  });

  it('returns safe insets for unknown platform', () => {
    const zone = safeZone('unknown');
    expect(zone.bottom).toBeGreaterThan(0);
    expect(zone.top).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    expect(safeZone('TikTok').bottom).toBe(safeZone('tiktok').bottom);
  });
});

describe('fitText', () => {
  const dims = { width: 1080, height: 1920 };

  it('returns nominal size when text is short enough to fit', () => {
    const nominal = vSize(0.067, dims);
    const result = fitText('Hi', 1080, 0.067, dims);
    expect(result).toBeCloseTo(nominal);
  });

  it('reduces font size when text would overflow maxWidth', () => {
    const longText = 'This is a very long headline that would definitely overflow';
    const nominal = vSize(0.067, dims);
    const result = fitText(longText, 500, 0.067, dims);
    expect(result).toBeLessThan(nominal);
  });

  it('scales proportionally to available width', () => {
    const longText = 'This is a very long headline that would definitely overflow';
    const wide = fitText(longText, 1000, 0.067, dims);
    const narrow = fitText(longText, 400, 0.067, dims);
    expect(wide).toBeGreaterThan(narrow);
  });
});
