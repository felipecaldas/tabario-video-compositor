import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface KenBurnsProps {
  children: React.ReactNode;
}

/** Wraps scene content with a slow zoom (1.0→1.06) and diagonal pan (3% of short edge). */
export const KenBurns: React.FC<KenBurnsProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const panAmount = Math.min(width, height) * 0.03;

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = 1 + 0.06 * progress;
  const translateX = panAmount * progress;
  const translateY = panAmount * 0.5 * progress;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
};
