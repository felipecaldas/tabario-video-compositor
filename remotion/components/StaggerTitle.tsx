import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';
import { useStyle } from '../StyleContext';
import { vSize } from '../utils/typography';

interface StaggerTitleProps {
  text: string;
  color?: string;
}

export const StaggerTitle: React.FC<StaggerTitleProps> = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { headingFamily } = useBrand();
  const style = useStyle();

  const words = text.split(' ');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '0 48px',
        fontFamily: headingFamily,
        fontSize: vSize(style.typography.heading_scale, { width, height }),
        fontWeight: 800,
        // Default to white for legibility on any clip background.
        color: color ?? '#ffffff',
        textShadow: '0 2px 20px rgba(0,0,0,0.85)',
      }}
    >
      {words.map((word, i) => {
        const wordFrame = Math.max(0, frame - i * 2);
        const opacity = spring({ frame: wordFrame, fps, config: { damping: 20, stiffness: 120 } });
        const translateY = (1 - opacity) * 30;
        return (
          <span
            key={i}
            style={{ opacity, transform: `translateY(${translateY}px)`, display: 'inline-block' }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
