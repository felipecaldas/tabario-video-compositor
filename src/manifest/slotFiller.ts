import { readFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { BrandProfile, Brief, CompositionManifest, Platform } from '../types';
import { CompositionManifestSchema } from './schema';
import { TemplateRegistry } from '../templates/registry';
import { StyleRegistry } from '../styles/registry';
import { UseCaseTemplate } from '../templates/schema';
import { EditStyle } from '../styles/schema';

const MAX_RETRIES = 3;
const PROMPT_PATH = join(__dirname, 'slotPrompt.md');

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY must be set');
    _client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: { 'X-Title': 'tabario-video-compositor' },
    });
  }
  return _client;
}

export interface SlotFillerInput {
  run_id: string;
  client_id: string;
  platform: Platform;
  brief: Brief;
  brand_profile: BrandProfile;
  clip_filenames: string[];
  voiceover_filename: string;
  target_fps?: number;
  use_case: string;
  style_id: string;
}

function buildSlotContext(input: SlotFillerInput): {
  template: UseCaseTemplate;
  style: EditStyle;
  brief: Brief;
  brand_profile: BrandProfile;
  run_id: string;
  client_id: string;
  platform: Platform;
  clip_filenames: string[];
  voiceover_filename: string;
  target_fps: number;
} {
  const template = TemplateRegistry.resolve(input.use_case);
  const style = StyleRegistry.resolve(input.style_id);

  return {
    template,
    style,
    brief: input.brief,
    brand_profile: input.brand_profile,
    run_id: input.run_id,
    client_id: input.client_id,
    platform: input.platform,
    clip_filenames: input.clip_filenames,
    voiceover_filename: input.voiceover_filename,
    target_fps: input.target_fps ?? 30,
  };
}

export function validateSlotFilling(
  manifest: CompositionManifest,
  template: UseCaseTemplate,
): string[] {
  const issues: string[] = [];

  const compactSlots = template.scene_blueprint.map((slot) => ({
    role: slot.role,
    cardinality: slot.cardinality,
    required_overlay: slot.required_overlay ?? null,
  }));

  for (const slot of compactSlots) {
    if (slot.cardinality === 'one') {
      const matching = manifest.scenes.filter(
        () => true,
      );
      const hasScene = matching.length > 0;
      if (!hasScene) {
        issues.push(`Missing scene for required slot role: ${slot.role}`);
      }
    }
    if (slot.cardinality === 'one_to_many') {
      const matching = manifest.scenes.filter(
        () => true,
      );
      if (matching.length === 0) {
        issues.push(`Missing scenes for one_to_many slot role: ${slot.role}`);
      }
    }
  }

  for (const slot of compactSlots) {
    if (!slot.required_overlay) continue;

    const overlayRole = slot.required_overlay.copy_role;
    const component = slot.required_overlay.component;

    const overlayFound = manifest.overlays.some(
      (overlay) => overlay.component === component,
    );

    const sceneOverlayFound = manifest.scenes.some(
      (scene) =>
        scene.scene_overlays?.some(
          (sceneOverlay) => sceneOverlay.component === component,
        ),
    );

    if (!overlayFound && !sceneOverlayFound) {
      issues.push(`Missing overlay for copy_role ${overlayRole} (component: ${component})`);
    }
  }

  if (template.closing && !manifest.closing) {
    issues.push('Template requires closing but manifest has no closing section');
  }

  if (!template.closing && manifest.closing) {
    issues.push('Template has no closing but manifest includes one');
  }

  if (manifest.style_id !== template.id && manifest.style_id !== undefined) {
    if (!StyleRegistry.isValid(manifest.style_id)) {
      issues.push(`Invalid style_id: ${manifest.style_id}`);
    }
  }

  if (manifest.use_case !== template.id) {
    issues.push(`use_case mismatch: expected ${template.id}, got ${manifest.use_case}`);
  }

  return issues;
}

export async function generateSlotFilledManifest(
  input: SlotFillerInput,
): Promise<CompositionManifest> {
  const context = buildSlotContext(input);
  const systemPrompt = readFileSync(PROMPT_PATH, 'utf-8');
  const model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash';

  const userMessage = JSON.stringify(context, null, 2);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(
      `[slotFiller] Generating slot-filled manifest attempt ${attempt}/${MAX_RETRIES} ` +
        `for run_id=${input.run_id}, use_case=${input.use_case}, style=${input.style_id}`,
    );

    const completion = await getClient().chat.completions.create({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';

    const stripped = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const jsonMatch =
      stripped.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, stripped];
    const jsonStr = (jsonMatch[1] ?? stripped).trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      lastError = new Error(
        `Attempt ${attempt}: LLM output is not valid JSON — ${(err as Error).message}`,
      );
      console.warn(`[slotFiller] ${lastError.message}`);
      continue;
    }

    const result = CompositionManifestSchema.safeParse(parsed);
    if (!result.success) {
      lastError = new Error(
        `Attempt ${attempt}: Manifest schema validation failed — ` +
          `${JSON.stringify(result.error.flatten())}`,
      );
      console.warn(`[slotFiller] ${lastError.message}`);
      continue;
    }

    const manifest = result.data as CompositionManifest;

    const slotIssues = validateSlotFilling(manifest, context.template);
    if (slotIssues.length > 0) {
      lastError = new Error(
        `Attempt ${attempt}: Slot filling validation failed — ${slotIssues.join('; ')}`,
      );
      console.warn(`[slotFiller] ${lastError.message}`);
      continue;
    }

    console.log(`[slotFiller] Slot-filled manifest generated successfully on attempt ${attempt}`);
    return manifest;
  }

  throw lastError ?? new Error('Slot-filling manifest generation failed after all retries');
}
