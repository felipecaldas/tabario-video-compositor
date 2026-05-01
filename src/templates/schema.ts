import { z } from 'zod';

export const SceneRoleSchema = z.enum([
  'hook', 'problem', 'product', 'solution', 'proof', 'outcome',
  'feature', 'step', 'recap',
  'testimonial', 'cta', 'intro', 'exterior', 'interior', 'highlight',
  'argument', 'punchline', 'soft_cta', 'close',
]);

export const RequiredLayoutSchema = z.enum([
  'talking_head_full', 'talking_head_pip', 'b_roll', 'split',
  'product_shot', 'flexible',
]);

export const SceneSlotSchema = z.object({
  role: SceneRoleSchema,
  duration_target_s: z.tuple([z.number().positive(), z.number().positive()]),
  required_layout: RequiredLayoutSchema,
  required_overlay: z.object({
    component: z.string(),
    copy_role: z.string(),
  }).optional(),
  cardinality: z.enum(['one', 'one_to_many']),
});

export const AssetRequirementSchema = z.object({
  role: z.string(),
  type: z.enum(['clip', 'image', 'voiceover', 'logo']),
  required: z.boolean(),
  description: z.string().optional(),
});

export const ClosingShapeSchema = z.object({
  component: z.literal('end_card'),
  duration_s: z.number().positive(),
  cta_role: z.string(),
});

export const DefaultTransitionSchema = z.object({
  from_role: SceneRoleSchema,
  to_role: SceneRoleSchema,
  type: z.enum(['soft_cut', 'color_wipe', 'scale_push', 'slide_push', 'zoom_blur']),
  direction: z.enum(['left', 'right', 'up', 'down']).optional(),
  accent_color: z.string().optional(),
});

export const GradeTypeSchema = z.enum([
  'neutral', 'desaturated_cool', 'vibrant_warm', 'high_contrast',
]);

export const UseCaseTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  scene_blueprint: z.array(SceneSlotSchema).min(1),
  required_assets: z.array(AssetRequirementSchema),
  closing: ClosingShapeSchema.optional(),
  /** Prescribed transition types per role boundary — used by buildTemplateManifest and the LLM prompt. */
  default_transitions: z.array(DefaultTransitionSchema).optional(),
  /** Default CSS grade applied per scene role in stub/test renders. */
  default_grade_per_role: z.record(SceneRoleSchema, GradeTypeSchema).optional(),
});

export type SceneRole = z.infer<typeof SceneRoleSchema>;
export type SceneSlot = z.infer<typeof SceneSlotSchema>;
export type DefaultTransition = z.infer<typeof DefaultTransitionSchema>;
export type UseCaseTemplate = z.infer<typeof UseCaseTemplateSchema>;
