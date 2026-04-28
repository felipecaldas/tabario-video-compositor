import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../../../BrandContext';
import { useStyle } from '../../../StyleContext';
import { vSize, safeZone } from '../../../utils/typography';
import { CaptionTrack } from '../../../../src/types';

interface TypewriterProps {
  track: CaptionTrack;
}

/**
 * Typewriter-style captions: words accumulate left-to-right as they are spoken.
 * The current word types in character-by-character. Line wraps every
 * max_words_visible words.
 */
export const Typewriter: React.FC<TypewriterProps> = ({ track }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { bodyFamily } = useBrand();
  const { caption_animation, typography } = useStyle();
  const { background, position, max_words_visible } = caption_animation;

  const { words } = track;
  if (!words.length) return null;

  const firstWordFrame = words[0].start_frame;
  const lastWordFrame = words[words.length - 1].end_frame;
  if (frame < firstWordFrame || frame > lastWordFrame) return null;

  // Find how many full words have been spoken, and the partial current word
  let spokenCount = 0;
  let partialWord = '';

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (frame >= w.end_frame) {
      spokenCount = i + 1;
    } else if (frame >= w.start_frame) {
      // Partially through this word — reveal proportional characters
      const wordDuration = w.end_frame - w.start_frame;
      const elapsed = frame - w.start_frame;
      const ratio = wordDuration > 0 ? elapsed / wordDuration : 1;
      const charCount = Math.max(1, Math.round(w.word.length * ratio));
      partialWord = w.word.slice(0, charCount);
      break;
    }
  }

  // Group into lines of max_words_visible; show only the current line
  const refIdx = partialWord ? spokenCount : spokenCount - 1;
  const groupStart = Math.floor(Math.max(0, refIdx) / max_words_visible) * max_words_visible;
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
      : {};

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
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '90%',
          ...bgStyle,
        }}
      >
        {lineWords.map((w, i) => {
          const wordIdx = groupStart + i;
          let displayWord = '';
          if (wordIdx < spokenCount) {
            displayWord = w.word; // fully spoken
          } else if (wordIdx === spokenCount && partialWord) {
            displayWord = partialWord; // currently typing
          } else {
            return null; // not yet reached
          }

          const isCurrent = wordIdx === spokenCount && Boolean(partialWord);

          return (
            <span
              key={`${wordIdx}-${w.start_frame}`}
              style={{
                fontFamily: bodyFamily,
                fontSize,
                fontWeight: 600,
                color: isCurrent ? '#ffffff' : 'rgba(255,255,255,0.85)',
                textShadow: '0 1px 10px rgba(0,0,0,0.9)',
                display: 'inline-block',
                lineHeight: 1.35,
                // Blinking cursor effect on the last typed word
                borderRight: isCurrent ? '2px solid #ffffff' : 'none',
              }}
            >
              {displayWord}
            </span>
          );
        })}
      </div>
    </div>
  );
};
