/**
 * Minimal mock of the `remotion` package used by component tests.  The
 * real package is a bundler+renderer bridge that only works under
 * Remotion's own environment; inside jsdom we substitute lightweight
 * stand-ins so component behaviour can be exercised with React Testing
 * Library.
 */

import * as React from 'react';

/** Default frame returned by useCurrentFrame.  Tests can override via
 *  `(useCurrentFrame as jest.Mock).mockReturnValue(n)` between renders. */
export const useCurrentFrame = jest.fn(() => 0);

export const useVideoConfig = jest.fn(() => ({
  fps: 30,
  durationInFrames: 90,
  width: 1080,
  height: 1920,
  id: 'TabarioComposition',
  defaultProps: {},
}));

/**
 * Faithful enough piecewise-linear interpolate — used by components to
 * drive opacity / scale / translate values.  Mirrors the contract of
 * Remotion's own interpolate for the finite ranges our components pass.
 */
export const interpolate = jest.fn(
  (input: number, inRange: number[], outRange: number[]) => {
    if (input <= inRange[0]) return outRange[0];
    if (input >= inRange[inRange.length - 1]) return outRange[outRange.length - 1];
    for (let i = 1; i < inRange.length; i++) {
      if (input <= inRange[i]) {
        const t = (input - inRange[i - 1]) / (inRange[i] - inRange[i - 1]);
        return outRange[i - 1] + t * (outRange[i] - outRange[i - 1]);
      }
    }
    return outRange[outRange.length - 1];
  },
);

/** Spring resolves to 1 by default so components animate to their steady state. */
export const spring = jest.fn(() => 1);

export const staticFile = jest.fn((s: string) => `/static/${s}`);

/** delayRender / continueRender are tracked so tests can assert font loading. */
export const delayRender = jest.fn((_label?: string) => 0);
export const continueRender = jest.fn();

type AnyStyle = React.CSSProperties | undefined;

export const AbsoluteFill: React.FC<React.PropsWithChildren<{ style?: AnyStyle }>> = ({
  children,
  style,
}) => (
  <div data-testid="absolute-fill" style={style}>
    {children}
  </div>
);

export const Sequence: React.FC<
  React.PropsWithChildren<{ from?: number; durationInFrames?: number }>
> = ({ children, from, durationInFrames }) => (
  <div data-testid="sequence" data-from={from} data-duration={durationInFrames}>
    {children}
  </div>
);

export const Video: React.FC<{ src: string; style?: AnyStyle }> = ({ src, style }) => (
  // eslint-disable-next-line jsx-a11y/media-has-caption
  <video data-testid="video" src={src} style={style} />
);

export const OffthreadVideo: React.FC<{ src: string; style?: AnyStyle }> = ({ src, style }) => (
  // eslint-disable-next-line jsx-a11y/media-has-caption
  <video data-testid="video" data-remotion-component="offthread-video" src={src} style={style} />
);

export const Audio: React.FC<{ src: string; volume?: number }> = ({ src, volume }) => (
  <audio data-testid="audio" src={src} data-volume={String(volume ?? '')} />
);

export const Img: React.FC<{ src: string; style?: AnyStyle }> = ({ src, style }) => (
  <img data-testid="img" src={src} style={style} alt="" />
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Composition: React.FC<any> = () => null;

export const registerRoot = jest.fn();
