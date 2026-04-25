import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useBrand } from '../BrandContext';
import { scaledSize } from '../utils/layout';

interface MotionBadgeProps {
  text: string;
}

/** Spring-animated pill badge for stat or keyword callouts. */
export const MotionBadge: React.FC<MotionBadgeProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { colors, bodyFamily } = useBrand();

  const progress = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });

  const fontSize = scaledSize(0.030, width, height);
  const paddingH = scaledSize(0.02, width, height);
  const paddingV = scaledSize(0.012, width, height);
  const bottomMargin = scaledSize(0.12, width, height);
  const leftMargin = scaledSize(0.05, width, height);

  const translateY = (1 - progress) * 80;
  const opacity = progress;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomMargin,
        left: leftMargin,
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div
        style={{
          background: colors.accent ?? '#3B82F6',
          borderRadius: 999,
          padding: `${paddingV}px ${paddingH}px`,
          fontFamily: bodyFamily,
          fontSize,
          fontWeight: 700,
          color: '#ffffff',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
    </div>
  );
};
