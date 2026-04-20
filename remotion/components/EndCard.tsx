import React from 'react';
import { Img, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';

interface EndCardProps {
  ctaText: string;
  ctaUrl?: string;
  showQr?: boolean;
  showLogo?: boolean;
}

export const EndCard: React.FC<EndCardProps> = ({
  ctaText,
  ctaUrl,
  showQr = false,
  showLogo = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, logoPrimaryUrl, bodyFontUrl, headingFontUrl } = useBrand();

  const opacity = spring({ frame, fps, config: { damping: 20, stiffness: 60 } });
  const translateY = (1 - opacity) * 40;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: colors.background ?? '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        padding: 48,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {showLogo && logoPrimaryUrl && (
        <Img
          src={logoPrimaryUrl}
          style={{ maxWidth: '50%', maxHeight: '20%', objectFit: 'contain' }}
        />
      )}
      <div
        style={{
          fontFamily: headingFontUrl ? `url(${headingFontUrl})` : 'sans-serif',
          fontSize: 48,
          fontWeight: 800,
          color: colors.primary ?? '#ffffff',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {ctaText}
      </div>
      {ctaUrl && (
        <div
          style={{
            fontFamily: bodyFontUrl ? `url(${bodyFontUrl})` : 'sans-serif',
            fontSize: 28,
            color: colors.accent ?? '#3B82F6',
            textAlign: 'center',
          }}
        >
          {ctaUrl}
        </div>
      )}
    </div>
  );
};
