import { z } from 'zod';

export const SceneRoleSchema = z.enum([
  'hook', 'problem', 'product', 'feature', 'step', 'recap',
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

export const UseCaseTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  scene_blueprint: z.array(SceneSlotSchema).min(1),
  required_assets: z.array(AssetRequirementSchema),
  closing: ClosingShapeSchema,
});

export type SceneRole = z.infer<typeof SceneRoleSchema>;
export type SceneSlot = z.infer<typeof SceneSlotSchema>;
export type UseCaseTemplate = z.infer<typeof UseCaseTemplateSchema>;
