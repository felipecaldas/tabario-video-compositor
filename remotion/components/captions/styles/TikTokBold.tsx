import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../../../BrandContext';
import { useStyle } from '../../../StyleContext';
import { vSize, safeZone } from '../../../utils/typography';
import { CaptionTrack } from '../../../../src/types';

interface TikTokBoldProps {
  track: CaptionTrack;
}

/**
 * TikTok-style captions: shows max_words_visible words at a time, grouped into
 * fixed windows. The currently-spoken word is highlighted with the active colour;
 * the rest of the group shows in white.
 */
export const TikTokBold: React.FC<TikTokBoldProps> = ({ track }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { headingFamily } = useBrand();
  const { caption_animation, typography } = useStyle();
  const { active_word_color, active_word_scale, background, position, max_words_visible } = caption_animation;

  const { words } = track;
  if (!words.length) return null;

  // Find the current word index
  const activeIdx = words.findIndex((w) => frame >= w.start_frame && frame <= w.end_frame);

  // Before first word or after last word — nothing to render
  if (activeIdx === -1) {
    const firstWordFrame = words[0].start_frame;
    const lastWordFrame = words[words.length - 1].end_frame;
    if (frame < firstWordFrame || frame > lastWordFrame) return null;
    // Between words (gap) — show the last completed group
  }

  // Use the index of the last word whose start has passed when we're in a gap
  const refIdx = activeIdx !== -1
    ? activeIdx
    : words.reduce((best, w, i) => (w.start_frame <= frame ? i : best), 0);

  // Group words into windows of max_words_visible; find which group refIdx belongs to
  const groupStart = Math.floor(refIdx / max_words_visible) * max_words_visible;
  const groupEnd = Math.min(groupStart + max_words_visible, words.length);
  const windowWords = words.slice(groupStart, groupEnd);

  // Positioning
  const zone = safeZone('tiktok');
  const fontSize = vSize(typography.body_scale * 1.1, { width, height });
  const positionStyle: React.CSSProperties =
    position === 'upper_third'
      ? { top: height * zone.top }
      : position === 'center'
      ? { top: '45%', transform: 'translateY(-50%)' }
      : { bottom: height * zone.bottom };

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 8,
        padding: `0 ${width * zone.left}px`,
        ...positionStyle,
      }}
    >
      {windowWords.map((w, i) => {
        const wordIdx = groupStart + i;
        const isActive = wordIdx === activeIdx;
        const scale = isActive ? active_word_scale : 1;
        const color = isActive ? (active_word_color ?? '#FFE600') : '#ffffff';
        const bgStyle: React.CSSProperties =
          background === 'pill'
            ? {
                background: isActive ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)',
                borderRadius: 999,
                padding: `4px 14px`,
              }
            : background === 'box'
            ? { background: 'rgba(0,0,0,0.65)', padding: `4px 10px` }
            : {};

        return (
          <span
            key={`${wordIdx}-${w.start_frame}`}
            style={{
              fontFamily: headingFamily,
              fontSize,
              fontWeight: 800,
              color,
              textShadow: isActive ? 'none' : '0 1px 8px rgba(0,0,0,0.8)',
              transform: `scale(${scale})`,
              transformOrigin: 'center bottom',
              display: 'inline-block',
              lineHeight: 1.2,
              letterSpacing: '0.01em',
              transition: 'transform 0.05s',
              ...bgStyle,
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
