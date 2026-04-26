import React from 'react';
import { OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useBrand } from '../BrandContext';

interface ColorWipeProps {
  fromSrc: string;
  toSrc: string;
  accentColor?: string;
}

/**
 * Brand-coloured wipe that sweeps from left to right over the current
 * Sequence duration, revealing the next clip.
 */
export const ColorWipe: React.FC<ColorWipeProps> = ({ fromSrc, toSrc, accentColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { colors } = useBrand();
  const color = accentColor ?? colors.accent ?? '#3B82F6';
  const half = durationInFrames / 2;

  const wipeWidth = interpolate(frame, [0, half, durationInFrames], [0, 100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromOpacity = interpolate(frame, [0, half], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toOpacity = interpolate(frame, [half, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, opacity: fromOpacity }}>
        <OffthreadVideo src={fromSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: toOpacity }}>
        <OffthreadVideo src={toSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
          clipPath: `inset(0 ${100 - wipeWidth}% 0 0)`,
        }}
      />
    </div>
  );
};
