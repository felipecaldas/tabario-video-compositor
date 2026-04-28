import React from 'react';
import { OffthreadVideo } from 'remotion';

interface FrameAccurateVideoProps {
  src: string;
  style?: React.CSSProperties;
}

export const FrameAccurateVideo: React.FC<FrameAccurateVideoProps> = ({ src, style }) => (
  <OffthreadVideo src={src} style={style} />
);
