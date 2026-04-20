import React from 'react';
import { Composition } from 'remotion';
import { CompositionManifest } from '../src/types';
import { TabarioComposition } from './TabarioComposition';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="TabarioComposition"
    component={TabarioComposition}
    durationInFrames={300}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{} as CompositionManifest}
    calculateMetadata={async ({ props }) => {
      const manifest = props as CompositionManifest;
      return {
        durationInFrames: manifest.duration_frames ?? 300,
        fps: manifest.fps ?? 30,
        width: manifest.width ?? 1080,
        height: manifest.height ?? 1920,
      };
    }}
  />
);
