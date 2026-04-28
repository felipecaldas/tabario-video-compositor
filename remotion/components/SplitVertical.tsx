import React from 'react';
import { FrameAccurateVideo } from './FrameAccurateVideo';

interface SplitVerticalProps {
  topSrc: string;
  bottomSrc: string;
  splitRatio?: number;
}

export const SplitVertical: React.FC<SplitVerticalProps> = ({
  topSrc,
  bottomSrc,
  splitRatio = 0.5,
}) => {
  const topPct = `${splitRatio * 100}%`;
  const bottomPct = `${(1 - splitRatio) * 100}%`;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: topPct, overflow: 'hidden' }}>
        <FrameAccurateVideo src={topSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ height: bottomPct, overflow: 'hidden' }}>
        <FrameAccurateVideo src={bottomSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};
