import React from 'react';
import { Img, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';
import { useStyle } from '../StyleContext';
import { vSize } from '../utils/typography';

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
  const { fps, width, height } = useVideoConfig();
  const { colors, logoPrimaryUrl, bodyFamily, headingFamily } = useBrand();
  const style = useStyle();

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
          fontFamily: headingFamily,
          fontSize: vSize(style.typography.heading_scale, { width, height }),
          fontWeight: style.typography.weight_heading,
          color: colors.primary ?? '#ffffff',
          textAlign: 'center',
          lineHeight: style.typography.line_height,
        }}
      >
        {ctaText}
      </div>
      {ctaUrl && (
        <div
          style={{
            fontFamily: bodyFamily,
            fontSize: vSize(style.typography.body_scale, { width, height }),
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
