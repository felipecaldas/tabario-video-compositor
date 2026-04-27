import { z } from 'zod';

export const TransitionTypeSchema = z.enum([
  'soft_cut', 'color_wipe', 'scale_push', 'slide_push', 'zoom_blur', 'slide',
]);

export const EditStyleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  preview_thumbnail_url: z.string().optional(),

  typography: z.object({
    heading_scale: z.number().positive(),
    body_scale: z.number().positive(),
    caption_scale: z.number().positive(),
    weight_heading: z.union([
      z.literal(600), z.literal(700), z.literal(800), z.literal(900),
    ]),
    weight_body: z.union([z.literal(400), z.literal(500), z.literal(600)]),
    case: z.enum(['sentence', 'upper', 'title']),
    tracking: z.number(),
    line_height: z.number().positive(),
  }),

  caption_animation: z.object({
    style: z.enum(['tiktok_bold', 'karaoke', 'typewriter', 'neon', 'subtle_fade']),
    active_word_color: z.string().nullable().optional(),
    active_word_scale: z.number().positive(),
    background: z.enum(['none', 'pill', 'bar', 'box']),
    position: z.enum(['lower_third', 'center', 'upper_third']),
    max_words_visible: z.number().int().min(2).max(7),
  }),

  transitions: z.object({
    preferred: z.array(TransitionTypeSchema).min(1),
    intensity: z.enum(['subtle', 'standard', 'punchy']),
    color_wipe_max: z.number().int().min(0),
  }),

  motion: z.object({
    energy: z.enum(['low', 'medium', 'high']),
    pace: z.enum(['slow', 'medium', 'fast']),
    ken_burns_strength: z.number().min(0).max(1),
  }),

  grade: z.enum([
    'desaturated_cool', 'vibrant_warm', 'high_contrast', 'neutral', 'cinematic_teal_orange',
  ]),

  overlays: z.object({
    density: z.enum(['minimal', 'standard', 'rich']),
    badges_max: z.number().int().min(0),
    use_lower_third: z.boolean(),
  }),
});

export type EditStyle = z.infer<typeof EditStyleSchema>;
