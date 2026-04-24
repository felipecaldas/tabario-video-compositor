import React from 'react';
import { Video, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface ScalePushProps {
  fromSrc: string;
  toSrc: string;
}

/**
 * Scale-push transition: the outgoing clip zooms in and fades while the
 * incoming clip zooms out of a smaller scale and fades in, synced to
 * the current Sequence duration.
 */
export const ScalePush: React.FC<ScalePushProps> = ({ fromSrc, toSrc }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fromScale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fromOpacity = interpolate(frame, [0, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toScale = interpolate(frame, [0, durationInFrames], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toOpacity = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, opacity: fromOpacity, transform: `scale(${fromScale})` }}>
        <Video src={fromSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: toOpacity, transform: `scale(${toScale})` }}>
        <Video src={toSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};
