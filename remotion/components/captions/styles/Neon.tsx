import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../../../BrandContext';
import { useStyle } from '../../../StyleContext';
import { vSize, safeZone } from '../../../utils/typography';
import { CaptionTrack } from '../../../../src/types';

interface NeonProps {
  track: CaptionTrack;
}

/**
 * Neon-style captions: karaoke-style layout with the active word lit up with
 * a vivid neon glow (text-shadow). Inactive words are dim.
 */
export const Neon: React.FC<NeonProps> = ({ track }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { headingFamily, colors } = useBrand();
  const { caption_animation, typography } = useStyle();
  const { active_word_color, background, position, max_words_visible } = caption_animation;

  const { words } = track;
  if (!words.length) return null;

  const firstWordFrame = words[0].start_frame;
  const lastWordFrame = words[words.length - 1].end_frame;
  if (frame < firstWordFrame || frame > lastWordFrame) return null;

  const activeIdx = words.findIndex((w) => frame >= w.start_frame && frame <= w.end_frame);
  const refIdx = activeIdx !== -1
    ? activeIdx
    : words.reduce((best, w, i) => (w.start_frame <= frame ? i : best), 0);

  const groupStart = Math.floor(refIdx / max_words_visible) * max_words_visible;
  const groupEnd = Math.min(groupStart + max_words_visible, words.length);
  const lineWords = words.slice(groupStart, groupEnd);

  const zone = safeZone('tiktok');
  const fontSize = vSize(typography.body_scale * 1.05, { width, height });
  const glowColor = active_word_color ?? colors.accent ?? '#00FFCC';

  const positionStyle: React.CSSProperties =
    position === 'upper_third'
      ? { top: height * zone.top }
      : position === 'center'
      ? { top: '45%', transform: 'translateY(-50%)' }
      : { bottom: height * zone.bottom };

  const bgStyle: React.CSSProperties =
    background === 'bar' || background === 'box'
      ? { background: 'rgba(0,0,0,0.7)', borderRadius: 12, padding: '10px 24px' }
      : { padding: '4px' };

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        ...positionStyle,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '90%',
          ...bgStyle,
        }}
      >
        {lineWords.map((w, i) => {
          const wordIdx = groupStart + i;
          const isActive = wordIdx === activeIdx;

          const neonGlow = [
            `0 0 4px ${glowColor}`,
            `0 0 10px ${glowColor}`,
            `0 0 20px ${glowColor}`,
            `0 0 40px ${glowColor}`,
          ].join(', ');

          return (
            <span
              key={`${wordIdx}-${w.start_frame}`}
              style={{
                fontFamily: headingFamily,
                fontSize,
                fontWeight: 700,
                color: isActive ? glowColor : 'rgba(255,255,255,0.35)',
                textShadow: isActive ? neonGlow : '0 1px 6px rgba(0,0,0,0.6)',
                display: 'inline-block',
                lineHeight: 1.3,
                letterSpacing: '0.02em',
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
