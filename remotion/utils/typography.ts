export interface VideoDims {
  width: number;
  height: number;
}

export interface SafeZoneInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Viewport-relative font size — scale is a fraction of the short edge.
 * e.g. vSize(0.09, {width:1080, height:1920}) → 97.2
 */
export function vSize(scale: number, dims: VideoDims): number {
  return scale * Math.min(dims.width, dims.height);
}

/**
 * Platform-specific safe zone insets as fractions of the corresponding dimension.
 * Components should position text inside these insets to avoid UI chrome.
 *
 * TikTok/Instagram bottom zone is ≥ 20% to clear the comment bar and nav.
 */
export function safeZone(platform: string): SafeZoneInsets {
  const p = platform.toLowerCase();
  if (p === 'tiktok' || p === 'instagram') {
    return { top: 0.05, bottom: 0.20, left: 0.04, right: 0.04 };
  }
  if (p === 'yt_shorts' || p === 'youtube_shorts') {
    return { top: 0.10, bottom: 0.12, left: 0.04, right: 0.04 };
  }
  // x / landscape / unknown
  return { top: 0.05, bottom: 0.10, left: 0.04, right: 0.04 };
}

/**
 * Returns a font-size in pixels that makes `text` fit inside `maxWidth` pixels,
 * starting from `nominalScale` and reducing until the text fits.
 * Uses a character-width approximation (0.55× font size per char on average).
 */
export function fitText(text: string, maxWidth: number, nominalScale: number, dims: VideoDims): number {
  const nominalPx = vSize(nominalScale, dims);
  const charWidthFactor = 0.55;
  const naturalWidth = text.length * nominalPx * charWidthFactor;
  if (naturalWidth <= maxWidth) return nominalPx;
  return (maxWidth / (text.length * charWidthFactor));
}
