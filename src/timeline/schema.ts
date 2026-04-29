import { z } from 'zod';

export const TimelineLayoutKindSchema = z.enum([
  'fullscreen',
  'sequential',
  'picture_in_picture',
  'split_horizontal',
  'split_vertical',
  'talking_head_full',
  'talking_head_sidebar',
  'talking_head_pip',
]);

export const TimelineTransitionTypeSchema = z.enum([
  'soft_cut',
  'slide_push',
  'color_wipe',
  'scale_push',
  'zoom_blur',
  'slide',
]);

export const TimelineSlideDirectionSchema = z.enum(['left', 'right', 'up', 'down']);

export const TimelineAssetSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  kind: z.enum(['video', 'audio', 'image', 'graphics']),
  role: z.string().optional(),
});

export const TimelineRegionSchema = z.object({
  id: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
  z_index: z.number().int().min(0).default(0),
});

export const TimelineLayoutSchema = z.object({
  id: z.string().min(1),
  kind: TimelineLayoutKindSchema,
  regions: z.array(TimelineRegionSchema).min(1),
});

export const TimelineVideoClipSchema = z.object({
  id: z.string().min(1),
  asset_id: z.string().min(1),
  scene_index: z.number().int().min(0),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().positive(),
  source_in_frame: z.number().int().min(0).default(0),
  layout_id: z.string().min(1),
  region_id: z.string().min(1).default('main'),
  grade: z.string().optional(),
});

export const TimelineAudioClipSchema = z.object({
  id: z.string().min(1),
  asset_id: z.string().min(1),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().positive().optional(),
  source_in_frame: z.number().int().min(0).default(0),
  gain_db: z.number().optional(),
});

export const TimelineGraphicsClipSchema = z.object({
  id: z.string().min(1),
  component: z.string().min(1),
  scene_index: z.number().int().min(0).optional(),
  start_frame: z.number().int().min(0),
  duration_frames: z.number().int().positive(),
  props: z.record(z.unknown()).default({}),
  render_mode: z.enum(['transparent_plate', 'full_frame_plate']).default('transparent_plate'),
});

export const TimelineCaptionWordSchema = z.object({
  word: z.string(),
  start_frame: z.number().int().min(0),
  end_frame: z.number().int().min(0),
});

export const TimelineTransitionSchema = z.object({
  id: z.string().min(1),
  from_clip_id: z.string().min(1),
  to_clip_id: z.string().min(1),
  type: TimelineTransitionTypeSchema,
  duration_frames: z.number().int().positive(),
  offset_frame: z.number().int().min(0),
  direction: TimelineSlideDirectionSchema.optional(),
  accent_color: z.string().optional(),
});

export const TimelineOutputSchema = z.object({
  id: z.string().min(1).default('final'),
  filename: z.string().min(1).default('composed.mp4'),
  container: z.enum(['mp4', 'mov']).default('mp4'),
  video_codec: z.enum(['h264']).default('h264'),
  audio_codec: z.enum(['aac']).default('aac'),
  pixel_format: z.enum(['yuv420p']).default('yuv420p'),
});

export const TimelineManifestSchema = z.object({
  schema: z.literal('timeline.v1'),
  source_schema: z.string().optional(),
  run_id: z.string().min(1),
  client_id: z.string().min(1),
  style_id: z.string().optional(),
  use_case: z.string().optional(),
  platform: z.string().min(1),
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration_frames: z.number().int().positive(),
  assets: z.array(TimelineAssetSchema),
  layouts: z.array(TimelineLayoutSchema).min(1),
  tracks: z.object({
    video: z.array(TimelineVideoClipSchema),
    audio: z.array(TimelineAudioClipSchema),
    graphics: z.array(TimelineGraphicsClipSchema),
  }),
  transitions: z.array(TimelineTransitionSchema),
  outputs: z.array(TimelineOutputSchema).min(1).default([{}]),
  captions: z.object({
    words: z.array(TimelineCaptionWordSchema),
  }).optional(),
}).superRefine((manifest, ctx) => {
  const assetIds = new Set(manifest.assets.map((asset) => asset.id));
  const videoAssetIds = new Set(manifest.assets.filter((asset) => asset.kind === 'video').map((asset) => asset.id));
  const audioAssetIds = new Set(manifest.assets.filter((asset) => asset.kind === 'audio').map((asset) => asset.id));
  const layoutIds = new Set(manifest.layouts.map((layout) => layout.id));
  const regionIdsByLayout = new Map(manifest.layouts.map((layout) => [
    layout.id,
    new Set(layout.regions.map((region) => region.id)),
  ]));
  const clipIds = new Set(manifest.tracks.video.map((clip) => clip.id));

  if (assetIds.size !== manifest.assets.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assets'],
      message: 'TimelineManifest asset ids must be unique',
    });
  }

  if (layoutIds.size !== manifest.layouts.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['layouts'],
      message: 'TimelineManifest layout ids must be unique',
    });
  }

  if (clipIds.size !== manifest.tracks.video.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tracks', 'video'],
      message: 'TimelineManifest video clip ids must be unique',
    });
  }

  manifest.tracks.video.forEach((clip, index) => {
    if (!videoAssetIds.has(clip.asset_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tracks', 'video', index, 'asset_id'],
        message: `Video clip "${clip.id}" references missing video asset "${clip.asset_id}"`,
      });
    }
    if (!layoutIds.has(clip.layout_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tracks', 'video', index, 'layout_id'],
        message: `Video clip "${clip.id}" references missing layout "${clip.layout_id}"`,
      });
    }
    if (!regionIdsByLayout.get(clip.layout_id)?.has(clip.region_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tracks', 'video', index, 'region_id'],
        message: `Video clip "${clip.id}" references missing region "${clip.region_id}" on layout "${clip.layout_id}"`,
      });
    }
    if (clip.start_frame + clip.duration_frames > manifest.duration_frames) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tracks', 'video', index, 'duration_frames'],
        message: `Video clip "${clip.id}" exceeds timeline duration`,
      });
    }
  });

  manifest.tracks.audio.forEach((clip, index) => {
    if (!audioAssetIds.has(clip.asset_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tracks', 'audio', index, 'asset_id'],
        message: `Audio clip "${clip.id}" references missing audio asset "${clip.asset_id}"`,
      });
    }
    if (clip.duration_frames !== undefined && clip.start_frame + clip.duration_frames > manifest.duration_frames) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tracks', 'audio', index, 'duration_frames'],
        message: `Audio clip "${clip.id}" exceeds timeline duration`,
      });
    }
  });

  manifest.tracks.graphics.forEach((clip, index) => {
    if (clip.start_frame + clip.duration_frames > manifest.duration_frames) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tracks', 'graphics', index, 'duration_frames'],
        message: `Graphics clip "${clip.id}" exceeds timeline duration`,
      });
    }
  });

  manifest.captions?.words.forEach((word, index) => {
    if (word.end_frame < word.start_frame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['captions', 'words', index, 'end_frame'],
        message: `Caption word "${word.word}" ends before it starts`,
      });
    }
    if (word.end_frame > manifest.duration_frames) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['captions', 'words', index, 'end_frame'],
        message: `Caption word "${word.word}" exceeds timeline duration`,
      });
    }
  });

  manifest.transitions.forEach((transition, index) => {
    if (!clipIds.has(transition.from_clip_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transitions', index, 'from_clip_id'],
        message: `Transition "${transition.id}" references missing source clip "${transition.from_clip_id}"`,
      });
    }
    if (!clipIds.has(transition.to_clip_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transitions', index, 'to_clip_id'],
        message: `Transition "${transition.id}" references missing target clip "${transition.to_clip_id}"`,
      });
    }
    if (transition.offset_frame + transition.duration_frames > manifest.duration_frames) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transitions', index, 'duration_frames'],
        message: `Transition "${transition.id}" exceeds timeline duration`,
      });
    }
  });

});

export type TimelineManifest = z.infer<typeof TimelineManifestSchema>;
export type TimelineLayoutKind = z.infer<typeof TimelineLayoutKindSchema>;
export type TimelineLayout = z.infer<typeof TimelineLayoutSchema>;
export type TimelineVideoClip = z.infer<typeof TimelineVideoClipSchema>;
export type TimelineAudioClip = z.infer<typeof TimelineAudioClipSchema>;
export type TimelineGraphicsClip = z.infer<typeof TimelineGraphicsClipSchema>;
export type TimelineTransition = z.infer<typeof TimelineTransitionSchema>;
