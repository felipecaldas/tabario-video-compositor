import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useBrand } from '../BrandContext';

interface CaptionBarProps {
  text: string;
}

export const CaptionBar: React.FC<CaptionBarProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { colors, bodyFamily } = useBrand();

  const opacity = interpolate(frame, [0, 8, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        opacity,
        fontFamily: bodyFamily,
        fontSize: 28,
        fontWeight: 500,
        color: colors.primary ?? '#ffffff',
        textAlign: 'center',
        lineHeight: 1.4,
      }}
    >
      {text}
    </div>
  );
};
