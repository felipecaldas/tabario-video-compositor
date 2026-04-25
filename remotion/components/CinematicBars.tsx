import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getAspectRatio } from '../utils/layout';

/** Optional cinematic letterbox (16:9) or pillarbox (1:1) bars. Renders nothing for 9:16. */
export const CinematicBars: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ar = getAspectRatio(width, height);

  const progress = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (ar === '9:16') return null;

  if (ar === '16:9') {
    const fullBarHeight = (height - height * (9 / 16 / 2.35)) / 2;
    const barHeight = fullBarHeight * progress;
    return (
      <>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: barHeight, background: '#000', zIndex: 100 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: barHeight, background: '#000', zIndex: 100 }} />
      </>
    );
  }

  // 1:1 — pillarbox
  const fullPillarWidth = width * 0.107;
  const pillarWidth = fullPillarWidth * progress;
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: pillarWidth, background: '#000', zIndex: 100 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: pillarWidth, background: '#000', zIndex: 100 }} />
    </>
  );
};
