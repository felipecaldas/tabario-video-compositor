import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../../../BrandContext';
import { useStyle } from '../../../StyleContext';
import { vSize, safeZone } from '../../../utils/typography';
import { CaptionTrack } from '../../../../src/types';

interface KaraokeProps {
  track: CaptionTrack;
}

/**
 * Karaoke-style captions: a fixed line of words, each turning to the accent
 * colour as it is spoken. Groups words into lines of max_words_visible.
 */
export const Karaoke: React.FC<KaraokeProps> = ({ track }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { bodyFamily } = useBrand();
  const { caption_animation, typography } = useStyle();
  const { active_word_color, background, position, max_words_visible } = caption_animation;

  const { words } = track;
  if (!words.length) return null;

  const activeIdx = words.findIndex((w) => frame >= w.start_frame && frame <= w.end_frame);
  const refIdx = activeIdx !== -1
    ? activeIdx
    : words.reduce((best, w, i) => (w.start_frame <= frame ? i : best), 0);

  const lastWordFrame = words[words.length - 1].end_frame;
  if (frame > lastWordFrame) return null;
  if (frame < words[0].start_frame) return null;

  // Group into lines of max_words_visible
  const groupStart = Math.floor(refIdx / max_words_visible) * max_words_visible;
  const groupEnd = Math.min(groupStart + max_words_visible, words.length);
  const lineWords = words.slice(groupStart, groupEnd);

  const zone = safeZone('tiktok');
  const fontSize = vSize(typography.caption_scale, { width, height });

  const positionStyle: React.CSSProperties =
    position === 'upper_third'
      ? { top: height * zone.top }
      : position === 'center'
      ? { top: '45%', transform: 'translateY(-50%)' }
      : { bottom: height * zone.bottom };

  const bgStyle: React.CSSProperties =
    background === 'bar' || background === 'box'
      ? { background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '8px 20px' }
      : { padding: '0 4px' };

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
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '90%',
          ...bgStyle,
        }}
      >
        {lineWords.map((w, i) => {
          const wordIdx = groupStart + i;
          const isSpoken = wordIdx < activeIdx || (activeIdx !== -1 && wordIdx === activeIdx);
          const isActive = wordIdx === activeIdx;
          const color = isActive
            ? (active_word_color ?? '#FFE600')
            : isSpoken
            ? 'rgba(255,255,255,0.95)'
            : 'rgba(255,255,255,0.45)';

          return (
            <span
              key={`${wordIdx}-${w.start_frame}`}
              style={{
                fontFamily: bodyFamily,
                fontSize,
                fontWeight: isActive ? 700 : 600,
                color,
                textShadow: '0 1px 8px rgba(0,0,0,0.8)',
                display: 'inline-block',
                lineHeight: 1.3,
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
