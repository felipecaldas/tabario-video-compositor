import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useBrand } from '../BrandContext';
import { scaledSize } from '../utils/layout';

interface BrandAccentLineProps {
  position?: 'bottom' | 'top' | 'middle';
}

/** Animated horizontal line that draws left-to-right using the brand accent color. */
export const BrandAccentLine: React.FC<BrandAccentLineProps> = ({ position = 'bottom' }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { colors } = useBrand();

  const scaleX = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const thickness = Math.max(2, scaledSize(0.003, width, height));

  const topOffset =
    position === 'top'
      ? scaledSize(0.08, width, height)
      : position === 'middle'
      ? height / 2
      : height - scaledSize(0.12, width, height);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: topOffset,
        width: '100%',
        height: thickness,
        background: colors.accent ?? '#3B82F6',
        transform: `scaleX(${scaleX})`,
        transformOrigin: 'left center',
      }}
    />
  );
};
