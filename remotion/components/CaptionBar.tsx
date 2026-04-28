import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useBrand } from '../BrandContext';
import { useStyle } from '../StyleContext';
import { vSize, safeZone } from '../utils/typography';

interface CaptionBarProps {
  text: string;
}

export const CaptionBar: React.FC<CaptionBarProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const { bodyFamily } = useBrand();
  const style = useStyle();

  const opacity = interpolate(frame, [0, 8, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const zone = safeZone('tiktok');
  const bottomOffset = height * zone.bottom;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 0,
        right: 0,
        padding: '16px 24px',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        opacity,
        fontFamily: bodyFamily,
        fontSize: vSize(style.typography.caption_scale, { width, height }),
        fontWeight: style.typography.weight_body,
        color: '#ffffff',
        textAlign: 'center',
        lineHeight: style.typography.line_height,
      }}
    >
      {text}
    </div>
  );
};
