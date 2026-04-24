import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';

interface LowerThirdProps {
  name: string;
  subtitle?: string;
}

export const LowerThird: React.FC<LowerThirdProps> = ({ name, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, bodyFamily } = useBrand();

  const slideIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const translateX = (1 - slideIn) * -400;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: 0,
        transform: `translateX(${translateX}px)`,
        background: colors.accent ?? '#3B82F6',
        padding: '12px 24px 12px 40px',
        borderRadius: '0 8px 8px 0',
        fontFamily: bodyFamily,
        maxWidth: '75%',
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>{name}</div>
      {subtitle && (
        <div style={{ fontSize: 20, fontWeight: 400, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};
