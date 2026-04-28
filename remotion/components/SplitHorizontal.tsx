import React from 'react';
import { FrameAccurateVideo } from './FrameAccurateVideo';

interface SplitHorizontalProps {
  leftSrc: string;
  rightSrc: string;
  splitRatio?: number;
}

export const SplitHorizontal: React.FC<SplitHorizontalProps> = ({
  leftSrc,
  rightSrc,
  splitRatio = 0.5,
}) => {
  const leftPct = `${splitRatio * 100}%`;
  const rightPct = `${(1 - splitRatio) * 100}%`;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      <div style={{ width: leftPct, overflow: 'hidden' }}>
        <FrameAccurateVideo src={leftSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ width: rightPct, overflow: 'hidden' }}>
        <FrameAccurateVideo src={rightSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};
