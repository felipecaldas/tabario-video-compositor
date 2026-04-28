import { z } from 'zod';

const TransitionTypeSchema = z.enum(['soft_cut', 'color_wipe', 'scale_push', 'slide_push', 'zoom_blur', 'slide']);
const LayoutTypeSchema = z.enum(['fullscreen', 'split_horizontal', 'split_vertical', 'picture_in_picture']);
const GradeTypeSchema = z.enum(['neutral', 'desaturated_cool', 'vibrant_warm', 'high_contrast']);
const ImageTextDensitySchema = z.enum(['none', 'low', 'medium', 'high']);
const MotionSchema = z.enum(['ken_burns', 'static']);
const TalkingHeadLayoutSchema = z.enum(['full', 'sidebar', 'pip_bottom_right']);
const SlideDirectionSchema = z.enum(['left', 'right', 'up', 'down']);
const ComponentTypeSchema = z.enum([
  'kinetic_title', 'stagger_title', 'lower_third', 'caption_bar',
  'split_horizontal', 'split_vertical', 'picture_in_picture',
  'soft_cut', 'color_wipe', 'scale_push', 'logo_reveal', 'end_card',
  'typographic_background', 'brand_accent_line', 'motion_badge', 'metric_callout',
]);

export const TextOverlaySchema = z.object({
  component: z.enum(['kinetic_title', 'stagger_title', 'caption_bar']),
  text: z.string(),
  props: z.record(z.unknown()).optional(),
});

export const CompositionManifestSchema = z.object({
  schema: z.union([z.literal('compose.v1'), z.literal('compose.v2')]),
  style_id: z.string().default('corporate_clean'),
  use_case: z.string().optional(),
  brief_id: z.string().optional(),
  client_id: z.string(),
  run_id: z.string(),
  platform: z.string(),
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration_frames: z.number().int().positive(),
  scenes: z.array(
    z.object({
      index: z.number().int().min(0),
      clip_filename: z.string().optional(), // Optional for typographic scenes
      duration_frames: z.number().int().positive(),
      layout: LayoutTypeSchema,
      grade: GradeTypeSchema.optional(),
      image_text_density: ImageTextDensitySchema.optional(),
      motion: MotionSchema.optional(),
      talking_head_layout: TalkingHeadLayoutSchema.optional(),
      // Scene-level overlays for text-heavy scenes
      scene_overlays: z.array(TextOverlaySchema).optional(),
    })
  ).min(1),
  transitions: z.array(
    z.object({
      between: z.tuple([z.number().int(), z.number().int()]),
      type: TransitionTypeSchema,
      duration_frames: z.number().int().positive(),
      accent_color: z.string().optional(),
      direction: SlideDirectionSchema.optional(),
    })
  ),
  overlays: z.array(
    z.object({
      component: ComponentTypeSchema,
      scene_index: z.number().int().min(0),
      start_frame: z.number().int().min(0),
      duration_frames: z.number().int().positive(),
      props: z.record(z.unknown()),
    })
  ),
  audio_track: z.object({
    voiceover_filename: z.string(),
    music_source: z.object({
      id: z.string().optional(),
      url: z.string().optional(),
    }).optional(),
    lufs_target: z.number().default(-16),
    music_ducking_db: z.number().default(-12),
  }),
  closing: z.object({
    component: z.literal('end_card'),
    cta: z.object({
      text: z.string(),
      url: z.string().optional(),
      show_qr: z.boolean().optional(),
    }),
    show_logo: z.boolean(),
    start_frame: z.number().int().min(0),
    duration_frames: z.number().int().positive(),
  }),
  narrative_arcs: z.array(
    z.object({
      range: z.tuple([z.number().int(), z.number().int()]),
      grade: GradeTypeSchema,
      music_cue: z.string().optional(),
    })
  ).optional(),
  caption_track: z.object({
    words: z.array(z.object({
      word: z.string(),
      start_frame: z.number().int().min(0),
      end_frame: z.number().int().min(0),
    })),
    pauses: z.array(z.object({
      start_frame: z.number().int().min(0),
      duration_frames: z.number().int().positive(),
    })).optional(),
  }).optional(),
});

export type CompositionManifestInput = z.input<typeof CompositionManifestSchema>;
export type TextOverlay = z.infer<typeof TextOverlaySchema>;
