import React, { useEffect } from 'react';
import { Video } from 'remotion';

interface FrameAccurateVideoProps {
  src: string;
  style?: React.CSSProperties;
}

const loggedSources = new Set<string>();

export const FrameAccurateVideo: React.FC<FrameAccurateVideoProps> = ({ src, style }) => {
  useEffect(() => {
    if (loggedSources.has(src)) {
      return;
    }
    loggedSources.add(src);
    console.log(`[remotion] FrameAccurateVideo mounted: src=${src}`);
  }, [src]);

  return <Video src={src} style={style} muted={true} />;
};
