import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';

interface StaggerTitleProps {
  text: string;
  color?: string;
}

export const StaggerTitle: React.FC<StaggerTitleProps> = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, headingFontUrl } = useBrand();

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
        fontFamily: headingFontUrl ? `url(${headingFontUrl})` : 'sans-serif',
        fontSize: 64,
        fontWeight: 800,
        color: color ?? colors.primary ?? '#ffffff',
        textShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      {words.map((word, i) => {
        const wordFrame = Math.max(0, frame - i * 4);
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
