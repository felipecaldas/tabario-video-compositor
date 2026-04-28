import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';
import { scaledSize } from '../utils/layout';

interface MetricCalloutProps {
  metric: string;
  label: string;
  color?: string;
}

/**
 * Large centered callout for proof-section metrics in ad templates.
 * Renders a hero number/stat with a supporting label on a dark scrim,
 * popping in with a fast spring on frame 0.
 */
export const MetricCallout: React.FC<MetricCalloutProps> = ({ metric, label, color }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { colors, headingFamily, bodyFamily } = useBrand();

  const progress = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  const scale = 0.7 + 0.3 * progress;
  const opacity = progress;

  const accentColor = color ?? colors.accent ?? '#FFC107';
  const metricSize = scaledSize(0.065, width, height);
  const labelSize = scaledSize(0.018, width, height);
  const scrimPadH = scaledSize(0.04, width, height);
  const scrimPadV = scaledSize(0.025, width, height);

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
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.62)',
          borderRadius: 16,
          padding: `${scrimPadV}px ${scrimPadH}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* Hero metric */}
        <span
          style={{
            fontFamily: headingFamily,
            fontSize: metricSize,
            fontWeight: 900,
            color: '#ffffff',
            textShadow: '0 2px 12px rgba(0,0,0,0.7)',
            lineHeight: 1,
          }}
        >
          {metric}
        </span>
        {/* Accent underline */}
        <div
          style={{
            height: 3,
            width: '60%',
            background: accentColor,
            borderRadius: 2,
          }}
        />
        {/* Supporting label */}
        <span
          style={{
            fontFamily: bodyFamily,
            fontSize: labelSize,
            fontWeight: 600,
            color: '#e0e0e0',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};
