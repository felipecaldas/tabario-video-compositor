import React from 'react';
import { Video, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface SoftCutProps {
  fromSrc: string;
  toSrc: string;
}

/**
 * Cross-fade between two clips over the current Sequence's full duration.
 */
export const SoftCut: React.FC<SoftCutProps> = ({ fromSrc, toSrc }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fromOpacity = interpolate(frame, [0, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toOpacity = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, opacity: fromOpacity }}>
        <Video src={fromSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: toOpacity }}>
        <Video src={toSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};
