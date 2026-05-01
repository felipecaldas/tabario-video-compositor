import React from 'react';
import { Composition } from 'remotion';
import { CompositionManifest } from '../src/types';
import { TimelineManifest } from '../src/timeline';
import { GraphicsPlateComposition, GraphicsPlateCompositionProps } from './GraphicsPlateComposition';
import { TabarioComposition } from './TabarioComposition';

const DEFAULT_COMPOSITION_MANIFEST: CompositionManifest = {
  schema: 'compose.v1',
  client_id: '',
  run_id: '',
  platform: 'tiktok',
  fps: 30,
  width: 1080,
  height: 1920,
  duration_frames: 300,
  scenes: [],
  transitions: [],
  overlays: [],
  audio_track: {
    voiceover_filename: '',
    lufs_target: -16,
    music_ducking_db: -12,
  },
  closing: {
    component: 'end_card',
    cta: { text: '' },
    show_logo: false,
    start_frame: 270,
    duration_frames: 30,
  },
};

const DEFAULT_GRAPHICS_TIMELINE: TimelineManifest = {
  schema: 'timeline.v1',
  run_id: '',
  client_id: '',
  platform: 'tiktok',
  fps: 30,
  width: 1080,
  height: 1920,
  duration_frames: 300,
  assets: [],
  layouts: [{
    id: 'layout:fullscreen',
    kind: 'fullscreen',
    regions: [{ id: 'main', x: 0, y: 0, width: 1, height: 1, z_index: 0 }],
  }],
  tracks: { video: [], audio: [], graphics: [] },
  transitions: [],
  outputs: [{
    id: 'final',
    filename: 'composed.mp4',
    container: 'mp4',
    video_codec: 'h264',
    audio_codec: 'aac',
    pixel_format: 'yuv420p',
  }],
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="TabarioComposition"
      component={TabarioComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_COMPOSITION_MANIFEST}
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
    <Composition
      id="GraphicsPlate"
      component={GraphicsPlateComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      // CRITICAL: declare every prop key the component accepts here.
      // Remotion v4 only forwards inputProps keys that exist in defaultProps;
      // keys missing from defaultProps are silently dropped during the
      // bundle/serve handshake, leaving the component with default values.
      defaultProps={{
        timeline: DEFAULT_GRAPHICS_TIMELINE,
        clip: null,
        plateType: 'graphics_clip',
        brandProfile: null,
      } as unknown as GraphicsPlateCompositionProps}
      calculateMetadata={async ({ props }) => {
        const typed = props as GraphicsPlateCompositionProps;
        const timeline = typed.timeline as TimelineManifest;
        const clip = typed.clip;
        return {
          durationInFrames: clip?.duration_frames ?? timeline.duration_frames ?? 300,
          fps: timeline.fps ?? 30,
          width: timeline.width ?? 1080,
          height: timeline.height ?? 1920,
          // CRITICAL: explicitly return the resolved props back. In Remotion v4
          // the renderer uses the props returned from calculateMetadata for the
          // composition; omitting this field causes the browser-side component
          // to fall back to defaultProps (durations are still correct because
          // they come from the metadata fields above, but timeline/clip/etc.
          // arrive as their defaults). This was the root cause of caption
          // plates rendering as blank ProRes 4444 alpha frames.
          props: typed,
        };
      }}
    />
  </>
);
