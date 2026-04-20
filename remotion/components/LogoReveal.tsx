import React from 'react';
import { Img, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { logoPrimaryUrl, logoSafeZoneRatio } = useBrand();

  if (!logoPrimaryUrl) return null;

  const opacity = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const scale = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const padding = `${logoSafeZoneRatio * 100}%`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: `scale(${scale})`,
        padding,
      }}
    >
      <Img src={logoPrimaryUrl} style={{ maxWidth: '60%', maxHeight: '30%', objectFit: 'contain' }} />
    </div>
  );
};
