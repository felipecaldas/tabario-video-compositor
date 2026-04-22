import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';

interface TypographicBackgroundProps {
  text: string;
  color?: string;
  backgroundColor?: string;
  animation?: 'fade' | 'slide' | 'scale';
}

export const TypographicBackground: React.FC<TypographicBackgroundProps> = ({
  text,
  color,
  backgroundColor,
  animation = 'fade',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, headingFontUrl, titleCase } = useBrand();

  const animatedProps = (() => {
    switch (animation) {
      case 'fade':
        return {
          opacity: spring({ frame, fps, config: { damping: 20, stiffness: 80 } }),
        };
      case 'slide':
        return {
          opacity: spring({ frame, fps, config: { damping: 20, stiffness: 80 } }),
          transform: `translateY(${(1 - spring({ frame, fps, config: { damping: 15, stiffness: 60 } })) * 50}px)`,
        };
      case 'scale':
        return {
          opacity: spring({ frame, fps, config: { damping: 20, stiffness: 80 } }),
          transform: `scale(${0.8 + spring({ frame, fps, config: { damping: 12, stiffness: 100 } }) * 0.2})`,
        };
      default:
        return { opacity: 1 };
    }
  })();

  const displayText =
    titleCase === 'upper'
      ? text.toUpperCase()
      : titleCase === 'title'
      ? text.replace(/\b\w/g, (c) => c.toUpperCase())
      : text;

  const bgColor = backgroundColor ?? colors.background ?? '#000000';
  const textColor = color ?? colors.primary ?? '#ffffff';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...animatedProps,
      }}
    >
      <div
        style={{
          fontFamily: headingFontUrl ? `url(${headingFontUrl})` : 'sans-serif',
          fontSize: 96,
          fontWeight: 900,
          color: textColor,
          textAlign: 'center',
          padding: '0 64px',
          textShadow: '0 8px 32px rgba(0,0,0,0.5)',
          maxWidth: '90%',
          wordWrap: 'break-word',
        }}
      >
        {displayText}
      </div>
    </div>
  );
};
