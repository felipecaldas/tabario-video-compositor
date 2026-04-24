import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';

interface KineticTitleProps {
  text: string;
  color?: string;
}

export const KineticTitle: React.FC<KineticTitleProps> = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, headingFamily, titleCase } = useBrand();

  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const opacity = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });

  const displayText =
    titleCase === 'upper'
      ? text.toUpperCase()
      : titleCase === 'title'
      ? text.replace(/\b\w/g, (c) => c.toUpperCase())
      : text;

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
        fontFamily: headingFamily,
        fontSize: 72,
        fontWeight: 800,
        color: color ?? colors.primary ?? '#ffffff',
        textAlign: 'center',
        padding: '0 48px',
        textShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      {displayText}
    </div>
  );
};
