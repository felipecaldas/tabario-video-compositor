import { readFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { BrandProfile, Brief, CompositionManifest, Platform } from '../types';
import { CompositionManifestSchema } from './schema';

const MAX_RETRIES = 3;
const PROMPT_PATH = join(__dirname, 'prompt.md');

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

export interface ManifestGeneratorInput {
  run_id: string;
  client_id: string;
  platform: Platform;
  brief: Brief;
  brand_profile: BrandProfile;
  clip_filenames: string[];
  voiceover_filename: string;
  target_fps?: number;
}

/**
 * Generate a CompositionManifest using an LLM (OpenRouter).
 * Retries up to MAX_RETRIES times on invalid JSON or schema violations.
 */
export async function generateManifest(input: ManifestGeneratorInput): Promise<CompositionManifest> {
  const systemPrompt = readFileSync(PROMPT_PATH, 'utf-8');
  const model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash';

  const userMessage = JSON.stringify({
    run_id: input.run_id,
    client_id: input.client_id,
    platform: input.platform,
    brief: input.brief,
    brand_profile: input.brand_profile,
    clip_filenames: input.clip_filenames,
    voiceover_filename: input.voiceover_filename,
    target_fps: input.target_fps,
  }, null, 2);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[manifest] Generating manifest attempt ${attempt}/${MAX_RETRIES} for run_id=${input.run_id}`);

    const completion = await getClient().chat.completions.create({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';

    // Strip <think>...</think> blocks (for reasoning models like Qwen3)
    const stripped = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Extract JSON if wrapped in fences
    const jsonMatch = stripped.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, stripped];
    const jsonStr = (jsonMatch[1] ?? stripped).trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      lastError = new Error(`Attempt ${attempt}: LLM output is not valid JSON — ${(err as Error).message}`);
      console.warn(`[manifest] ${lastError.message}`);
      continue;
    }

    const result = CompositionManifestSchema.safeParse(parsed);
    if (!result.success) {
      lastError = new Error(`Attempt ${attempt}: Manifest schema validation failed — ${JSON.stringify(result.error.flatten())}`);
      console.warn(`[manifest] ${lastError.message}`);
      continue;
    }

    console.log(`[manifest] Manifest generated successfully on attempt ${attempt}`);
    return result.data as CompositionManifest;
  }

  throw lastError ?? new Error('Manifest generation failed after all retries');
}
