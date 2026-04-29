import React from 'react';
import { AbsoluteFill, Composition } from 'remotion';

const ProbeComposition: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        color: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 48,
      }}
    >
      Probe
    </AbsoluteFill>
  );
};

export const RemotionProbeRoot: React.FC = () => (
  <Composition
    id="ProbeComposition"
    component={ProbeComposition}
    durationInFrames={30}
    fps={30}
    width={640}
    height={360}
    defaultProps={{}}
  />
);
