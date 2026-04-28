import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { useBrand } from '../BrandContext';
import { useStyle } from '../StyleContext';
import { vSize } from '../utils/typography';

interface KineticTitleProps {
  text: string;
  color?: string;
}

export const KineticTitle: React.FC<KineticTitleProps> = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { headingFamily, titleCase } = useBrand();
  const style = useStyle();

  // Scale pops in with spring; opacity reaches full visibility by frame 3
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const opacity = interpolate(frame, [0, 3], [0, 1], { extrapolateRight: 'clamp' });

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
        fontSize: vSize(style.typography.heading_scale, { width, height }),
        fontWeight: 800,
        // Default to white so text is legible over any clip background.
        // Callers (non-ad templates) can pass an explicit color override.
        color: color ?? '#ffffff',
        textAlign: 'center',
        padding: '0 48px',
        textShadow: '0 2px 20px rgba(0,0,0,0.85)',
      }}
    >
      {displayText}
    </div>
  );
};
