import React from 'react';
import { Video, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useBrand } from '../BrandContext';
import { getAspectRatio, scaledSize } from '../utils/layout';
import { TalkingHeadLayout } from '../../src/types';

interface TalkingHeadSceneProps {
  src: string;
  variant: TalkingHeadLayout;
}

export const TalkingHeadScene: React.FC<TalkingHeadSceneProps> = ({ src, variant }) => {
  const { width, height } = useVideoConfig();
  const { colors, bodyFamily } = useBrand();
  const ar = getAspectRatio(width, height);

  if (variant === 'full') {
    return <FullPresenter src={src} colors={colors} bodyFamily={bodyFamily} width={width} height={height} />;
  }
  if (variant === 'sidebar') {
    return <SidebarPresenter src={src} ar={ar} />;
  }
  return <PipPresenter src={src} colors={colors} width={width} height={height} />;
};

const FullPresenter: React.FC<{
  src: string;
  colors: { accent?: string };
  bodyFamily: string;
  width: number;
  height: number;
}> = ({ src, colors, width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const barHeight = scaledSize(0.12, width, height);

  const barOpacity = interpolate(frame, [0, Math.round(fps * 0.4)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: barHeight,
          background: colors.accent ?? '#3B82F6',
          opacity: barOpacity,
        }}
      />
    </div>
  );
};

const SidebarPresenter: React.FC<{
  src: string;
  ar: string;
}> = ({ src, ar }) => {
  const isVertical = ar === '9:16';

  if (isVertical) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: '0 0 55%', background: '#000' }} />
        <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden' }}>
          <Video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
    );
  }

  const presenterPct = ar === '1:1' ? 45 : 40;
  const contentPct = 100 - presenterPct;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: `0 0 ${contentPct}%`, background: '#000' }} />
      <div style={{ flex: `0 0 ${presenterPct}%`, position: 'relative', overflow: 'hidden' }}>
        <Video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};

const PipPresenter: React.FC<{
  src: string;
  colors: { accent?: string };
  width: number;
  height: number;
}> = ({ src, colors, width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pipSize = scaledSize(0.25, width, height);
  const margin = scaledSize(0.015, width, height);

  const scale = interpolate(frame, [0, Math.round(fps * 0.3)], [0.5, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <div
        style={{
          position: 'absolute',
          bottom: margin,
          right: margin,
          width: pipSize,
          height: pipSize,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `${Math.max(2, scaledSize(0.003, width, height))}px solid ${colors.accent ?? '#3B82F6'}`,
          transform: `scale(${scale})`,
          transformOrigin: 'bottom right',
        }}
      >
        <Video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};
