import { z } from 'zod';

const TransitionTypeSchema = z.enum(['soft_cut', 'color_wipe', 'scale_push']);
const LayoutTypeSchema = z.enum(['fullscreen', 'split_horizontal', 'split_vertical', 'picture_in_picture']);
const GradeTypeSchema = z.enum(['neutral', 'desaturated_cool', 'vibrant_warm', 'high_contrast']);
const ComponentTypeSchema = z.enum([
  'kinetic_title', 'stagger_title', 'lower_third', 'caption_bar',
  'split_horizontal', 'split_vertical', 'picture_in_picture',
  'soft_cut', 'color_wipe', 'scale_push', 'logo_reveal', 'end_card',
]);

export const CompositionManifestSchema = z.object({
  schema: z.literal('compose.v1'),
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
      clip_filename: z.string(),
      duration_frames: z.number().int().positive(),
      layout: LayoutTypeSchema,
      grade: GradeTypeSchema.optional(),
    })
  ).min(1),
  transitions: z.array(
    z.object({
      between: z.tuple([z.number().int(), z.number().int()]),
      type: TransitionTypeSchema,
      duration_frames: z.number().int().positive(),
      accent_color: z.string().optional(),
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
});

export type CompositionManifestInput = z.input<typeof CompositionManifestSchema>;
