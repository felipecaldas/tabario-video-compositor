import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';
import { useStyle } from '../StyleContext';
import { vSize, safeZone } from '../utils/typography';

interface LowerThirdProps {
  name: string;
  subtitle?: string;
}

export const LowerThird: React.FC<LowerThirdProps> = ({ name, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { colors, bodyFamily } = useBrand();
  const style = useStyle();

  const slideIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const translateX = (1 - slideIn) * -400;

  const zone = safeZone('tiktok');
  const bottomOffset = height * zone.bottom;
  const nameSize = vSize(style.typography.body_scale, { width, height });
  const subtitleSize = nameSize * 0.65;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 0,
        transform: `translateX(${translateX}px)`,
        background: colors.accent ?? '#3B82F6',
        padding: '12px 24px 12px 40px',
        borderRadius: '0 8px 8px 0',
        fontFamily: bodyFamily,
        maxWidth: '75%',
      }}
    >
      <div style={{ fontSize: nameSize, fontWeight: style.typography.weight_heading, color: '#ffffff', lineHeight: 1.2 }}>{name}</div>
      {subtitle && (
        <div style={{ fontSize: subtitleSize, fontWeight: style.typography.weight_body, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};
