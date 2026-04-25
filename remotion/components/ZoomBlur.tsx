import React from 'react';
import { Video, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface ZoomBlurProps {
  fromSrc: string;
  toSrc: string;
}

/** High-energy transition: outgoing zooms in and blurs out; incoming zooms in from small and clears. */
export const ZoomBlur: React.FC<ZoomBlurProps> = ({ fromSrc, toSrc }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fromScale = 1 + 0.2 * progress;
  const fromBlur = 12 * progress;
  const fromOpacity = 1 - progress;

  const toScale = 0.85 + 0.15 * progress;
  const toBlur = 12 * (1 - progress);
  const toOpacity = progress;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${fromScale})`,
          filter: `blur(${fromBlur}px)`,
          opacity: fromOpacity,
        }}
      >
        <Video src={fromSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${toScale})`,
          filter: `blur(${toBlur}px)`,
          opacity: toOpacity,
        }}
      >
        <Video src={toSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};
