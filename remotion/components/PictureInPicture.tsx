import React from 'react';
import { Video } from 'remotion';

type PipPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface PictureInPictureProps {
  mainSrc: string;
  overlaySrc: string;
  position?: PipPosition;
  overlayScale?: number;
}

const POSITION_STYLES: Record<PipPosition, React.CSSProperties> = {
  'top-left': { top: 24, left: 24 },
  'top-right': { top: 24, right: 24 },
  'bottom-left': { bottom: 24, left: 24 },
  'bottom-right': { bottom: 24, right: 24 },
};

export const PictureInPicture: React.FC<PictureInPictureProps> = ({
  mainSrc,
  overlaySrc,
  position = 'bottom-right',
  overlayScale = 0.3,
}) => (
  <div style={{ position: 'absolute', inset: 0 }}>
    <Video src={mainSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    <div
      style={{
        position: 'absolute',
        width: `${overlayScale * 100}%`,
        aspectRatio: '9/16',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        ...POSITION_STYLES[position],
      }}
    >
      <Video src={overlaySrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  </div>
);
