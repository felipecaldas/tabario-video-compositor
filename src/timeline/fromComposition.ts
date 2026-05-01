import {
  ComponentType,
  CompositionManifest,
  LayoutType,
  ManifestScene,
  TalkingHeadLayout,
} from '../types';
import { TimelineLayoutKind, TimelineManifest, TimelineManifestSchema } from './schema';

export interface BuildTimelineOptions {
  /** Filenames expected to be available in the run directory. */
  availableClipFilenames?: string[];
  outputFilename?: string;
}

const FULL_FRAME_REGION = [{ id: 'main', x: 0, y: 0, width: 1, height: 1, z_index: 0 }];

const LAYOUT_REGIONS: Record<TimelineLayoutKind, TimelineManifest['layouts'][number]['regions']> = {
  fullscreen: FULL_FRAME_REGION,
  sequential: FULL_FRAME_REGION,
  picture_in_picture: [
    { id: 'main', x: 0, y: 0, width: 1, height: 1, z_index: 0 },
    { id: 'pip', x: 0.62, y: 0.62, width: 0.32, height: 0.28, z_index: 1 },
  ],
  split_horizontal: [
    { id: 'top', x: 0, y: 0, width: 1, height: 0.5, z_index: 0 },
    { id: 'bottom', x: 0, y: 0.5, width: 1, height: 0.5, z_index: 0 },
  ],
  split_vertical: [
    { id: 'left', x: 0, y: 0, width: 0.5, height: 1, z_index: 0 },
    { id: 'right', x: 0.5, y: 0, width: 0.5, height: 1, z_index: 0 },
  ],
  talking_head_full: FULL_FRAME_REGION,
  talking_head_sidebar: [
    { id: 'presenter', x: 0, y: 0, width: 0.38, height: 1, z_index: 1 },
    { id: 'supporting', x: 0.38, y: 0, width: 0.62, height: 1, z_index: 0 },
  ],
  talking_head_pip: [
    { id: 'supporting', x: 0, y: 0, width: 1, height: 1, z_index: 0 },
    { id: 'presenter', x: 0.62, y: 0.62, width: 0.32, height: 0.28, z_index: 1 },
  ],
};

function layoutKindForScene(scene: ManifestScene): TimelineLayoutKind {
  if (scene.talking_head_layout) {
    return talkingHeadLayoutKind(scene.talking_head_layout);
  }

  if (scene.layout === 'fullscreen') {
    return 'sequential';
  }

  return scene.layout;
}

function talkingHeadLayoutKind(layout: TalkingHeadLayout): TimelineLayoutKind {
  switch (layout) {
    case 'full':
      return 'talking_head_full';
    case 'sidebar':
      return 'talking_head_sidebar';
    case 'pip_bottom_right':
      return 'talking_head_pip';
  }
}

function layoutId(kind: TimelineLayoutKind): string {
  return `layout:${kind}`;
}

function assetId(filename: string): string {
  return `asset:${filename}`;
}

function clipId(sceneIndex: number): string {
  return `scene:${sceneIndex}:video`;
}

function firstRegionForLayout(kind: TimelineLayoutKind): string {
  return LAYOUT_REGIONS[kind][0].id;
}

function graphicsClipId(component: ComponentType | string, sceneIndex: number | undefined, index: number): string {
  const scenePart = sceneIndex === undefined ? 'global' : `scene:${sceneIndex}`;
  return `${scenePart}:graphics:${component}:${index}`;
}

export function buildTimelineManifest(
  manifest: CompositionManifest,
  options: BuildTimelineOptions = {},
): TimelineManifest {
  const availableClipFilenames = new Set(options.availableClipFilenames ?? []);
  const checkAvailableFiles = availableClipFilenames.size > 0;
  const missingClipFilenames = manifest.scenes
    .map((scene) => scene.clip_filename)
    .filter((filename): filename is string => Boolean(filename))
    .filter((filename) => checkAvailableFiles && !availableClipFilenames.has(filename));

  if (missingClipFilenames.length > 0) {
    throw new Error(`TimelineManifest missing clips: ${[...new Set(missingClipFilenames)].join(', ')}`);
  }

  let cursor = 0;
  const videoClips = manifest.scenes.flatMap((scene) => {
    const startFrame = cursor;
    cursor += scene.duration_frames;

    if (!scene.clip_filename) {
      return [];
    }

    const kind = layoutKindForScene(scene);
    return [{
      id: clipId(scene.index),
      asset_id: assetId(scene.clip_filename),
      scene_index: scene.index,
      start_frame: startFrame,
      duration_frames: scene.duration_frames,
      source_in_frame: 0,
      layout_id: layoutId(kind),
      region_id: firstRegionForLayout(kind),
      grade: scene.grade,
    }];
  });

  const videoAssetFilenames = [...new Set(
    manifest.scenes
      .map((scene) => scene.clip_filename)
      .filter((filename): filename is string => Boolean(filename)),
  )];

  const audioAssets = [
    { id: assetId(manifest.audio_track.voiceover_filename), filename: manifest.audio_track.voiceover_filename, kind: 'audio' as const, role: 'voiceover' },
    ...(manifest.audio_track.music_source?.url
      ? [{ id: assetId(manifest.audio_track.music_source.url), filename: manifest.audio_track.music_source.url, kind: 'audio' as const, role: 'music' }]
      : []),
  ];

  const sceneStartFrames = new Map<number, number>();
  let sceneCursor = 0;
  manifest.scenes.forEach((scene) => {
    sceneStartFrames.set(scene.index, sceneCursor);
    sceneCursor += scene.duration_frames;
  });

  const usedLayoutKinds = new Set<TimelineLayoutKind>([
    ...manifest.scenes.map(layoutKindForScene),
    'fullscreen',
    'sequential',
    'picture_in_picture',
    'split_horizontal',
    'split_vertical',
    'talking_head_full',
    'talking_head_sidebar',
    'talking_head_pip',
  ]);

  const timeline = {
    schema: 'timeline.v1' as const,
    source_schema: manifest.schema,
    run_id: manifest.run_id,
    client_id: manifest.client_id,
    style_id: manifest.style_id,
    use_case: manifest.use_case,
    platform: manifest.platform,
    fps: manifest.fps,
    width: manifest.width,
    height: manifest.height,
    duration_frames: manifest.duration_frames,
    assets: [
      ...videoAssetFilenames.map((filename) => ({
        id: assetId(filename),
        filename,
        kind: 'video' as const,
        role: 'source',
      })),
      ...audioAssets,
    ],
    layouts: [...usedLayoutKinds].map((kind) => ({
      id: layoutId(kind),
      kind,
      regions: LAYOUT_REGIONS[kind],
    })),
    tracks: {
      video: videoClips,
      audio: [{
        id: 'audio:voiceover',
        asset_id: assetId(manifest.audio_track.voiceover_filename),
        start_frame: 0,
        duration_frames: manifest.duration_frames,
        source_in_frame: 0,
      },
      ...(manifest.audio_track.music_source?.url
        ? [{
          id: 'audio:music',
          asset_id: assetId(manifest.audio_track.music_source.url),
          start_frame: 0,
          duration_frames: manifest.duration_frames,
          source_in_frame: 0,
          gain_db: manifest.audio_track.music_ducking_db,
        }]
        : [])],
      graphics: [
        ...manifest.scenes.flatMap((scene) => {
          const sceneStartFrame = sceneStartFrames.get(scene.index) ?? 0;
          return (scene.scene_overlays ?? []).map((overlay, index) => ({
            id: graphicsClipId(overlay.component, scene.index, index),
            component: overlay.component,
            scene_index: scene.index,
            start_frame: sceneStartFrame,
            duration_frames: scene.duration_frames,
            props: { ...overlay.props, text: overlay.text },
            render_mode: 'transparent_plate' as const,
          }));
        }),
        ...manifest.overlays.map((overlay, index) => ({
          id: graphicsClipId(overlay.component, overlay.scene_index, index),
          component: overlay.component,
          scene_index: overlay.scene_index,
          start_frame: overlay.start_frame,
          duration_frames: overlay.duration_frames,
          props: overlay.props,
          render_mode: 'transparent_plate' as const,
        })),
        ...(manifest.closing
          ? [{
            id: 'graphics:closing:end_card',
            component: manifest.closing.component,
            start_frame: manifest.closing.start_frame,
            duration_frames: manifest.closing.duration_frames,
            props: manifest.closing,
            render_mode: 'transparent_plate' as const,
          }]
          : []),
      ],
    },
    transitions: manifest.transitions.flatMap((transition, index) => {
      const fromClipId = clipId(transition.between[0]);
      const toClipId = clipId(transition.between[1]);
      const toClip = videoClips.find((clip) => clip.id === toClipId);

      if (!toClip) {
        return [];
      }

      return [{
        id: `transition:${index}:${transition.type}`,
        from_clip_id: fromClipId,
        to_clip_id: toClipId,
        type: transition.type,
        duration_frames: transition.duration_frames,
        offset_frame: Math.max(0, toClip.start_frame - transition.duration_frames),
        direction: transition.direction,
        accent_color: transition.accent_color,
      }];
    }),
    outputs: [{
      id: 'final',
      filename: options.outputFilename ?? 'composed.mp4',
      container: 'mp4' as const,
      video_codec: 'h264' as const,
      audio_codec: 'aac' as const,
      pixel_format: 'yuv420p' as const,
    }],
    captions: manifest.caption_track
      ? {
        words: manifest.caption_track.words,
      }
      : undefined,
  };

  return TimelineManifestSchema.parse(timeline);
}

export function remotionLayoutForTimelineKind(kind: TimelineLayoutKind): LayoutType | undefined {
  switch (kind) {
    case 'fullscreen':
    case 'sequential':
    case 'talking_head_full':
      return 'fullscreen';
    case 'picture_in_picture':
    case 'talking_head_pip':
      return 'picture_in_picture';
    case 'split_horizontal':
      return 'split_horizontal';
    case 'split_vertical':
    case 'talking_head_sidebar':
      return 'split_vertical';
  }
}
