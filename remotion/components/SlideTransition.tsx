import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { FrameAccurateVideo } from './FrameAccurateVideo';

interface SlideTransitionProps {
  fromSrc: string;
  toSrc: string;
  direction?: 'left' | 'right' | 'up' | 'down';
}

/** Directional slide: outgoing clip exits, incoming enters from the opposite edge. No opacity change — hard edge. */
export const SlideTransition: React.FC<SlideTransitionProps> = ({
  fromSrc,
  toSrc,
  direction = 'left',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isHorizontal = direction === 'left' || direction === 'right';
  const axis = isHorizontal ? width : height;
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;

  const fromOffset = sign * axis * progress;
  const toOffset = sign * axis * (progress - 1);

  const fromTransform = isHorizontal
    ? `translateX(${fromOffset}px)`
    : `translateY(${fromOffset}px)`;
  const toTransform = isHorizontal
    ? `translateX(${toOffset}px)`
    : `translateY(${toOffset}px)`;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: fromTransform }}>
        <FrameAccurateVideo src={fromSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: toTransform }}>
        <FrameAccurateVideo src={toSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};
