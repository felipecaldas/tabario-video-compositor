import type React from 'react';

export declare const AbsoluteFill: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>>;
export declare const Audio: React.FC<{ src: string; volume?: number } & Record<string, unknown>>;
export declare const Composition: React.FC<Record<string, unknown>>;
export declare const Img: React.FC<{ src: string; style?: React.CSSProperties } & Record<string, unknown>>;
export declare const OffthreadVideo: React.FC<{ src: string; style?: React.CSSProperties } & Record<string, unknown>>;
export declare const Sequence: React.FC<React.PropsWithChildren<{ from?: number; durationInFrames?: number }>>;
export declare const Video: React.FC<{ src: string; style?: React.CSSProperties } & Record<string, unknown>>;
export declare const continueRender: (handle: number) => void;
export declare const delayRender: (label?: string) => number;
export declare const interpolate: (
  input: number,
  inputRange: number[],
  outputRange: number[],
  options?: Record<string, unknown>,
) => number;
export declare const registerRoot: (component: React.FC) => void;
export declare const spring: (options: Record<string, unknown>) => number;
export declare const staticFile: (path: string) => string;
export declare const useCurrentFrame: () => number;
export declare const useVideoConfig: () => {
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  id?: string;
  defaultProps?: Record<string, unknown>;
};
