/**
 * Unit tests for src/manifest/generator.ts — mocks the OpenAI client and
 * covers JSON extraction, <think> stripping, retry-on-parse failure,
 * retry-on-schema failure, and final error propagation after MAX_RETRIES.
 */

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return class {
    chat = { completions: { create: mockCreate } };
    constructor(_: unknown) {
      // swallow config
    }
  };
});

import { generateManifest, ManifestGeneratorInput } from '../../src/manifest/generator';

function validManifestJson(runId: string): Record<string, unknown> {
  return {
    schema: 'compose.v1',
    client_id: 'client-1',
    run_id: runId,
    platform: 'tiktok',
    fps: 30,
    width: 1080,
    height: 1920,
    duration_frames: 150,
    scenes: [
      { index: 0, clip_filename: 'c.mp4', duration_frames: 150, layout: 'fullscreen' },
    ],
    transitions: [],
    overlays: [],
    audio_track: {
      voiceover_filename: 'v.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card',
      cta: { text: 'Go' },
      show_logo: true,
      start_frame: 120,
      duration_frames: 30,
    },
  };
}

function makeInput(): ManifestGeneratorInput {
  return {
    run_id: 'run-x',
    client_id: 'client-1',
    platform: 'tiktok',
    brief: { hook: 'hi' },
    brand_profile: { id: 'bp', client_id: 'client-1' },
    clip_filenames: ['c.mp4'],
    voiceover_filename: 'v.mp3',
  };
}

function reply(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

describe('generateManifest', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENROUTER_API_KEY = 'key';
  });

  it('parses a raw JSON response', async () => {
    mockCreate.mockResolvedValue(reply(JSON.stringify(validManifestJson('run-x'))));
    const m = await generateManifest(makeInput());
    expect(m.schema).toBe('compose.v1');
    expect(m.run_id).toBe('run-x');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('extracts JSON from a ```json``` code fence', async () => {
    const content = '```json\n' + JSON.stringify(validManifestJson('run-x')) + '\n```';
    mockCreate.mockResolvedValue(reply(content));
    const m = await generateManifest(makeInput());
    expect(m.schema).toBe('compose.v1');
  });

  it('extracts JSON from an un-tagged ``` fence', async () => {
    const content = '```\n' + JSON.stringify(validManifestJson('run-x')) + '\n```';
    mockCreate.mockResolvedValue(reply(content));
    const m = await generateManifest(makeInput());
    expect(m.schema).toBe('compose.v1');
  });

  it('strips <think>...</think> reasoning blocks before parsing', async () => {
    const content =
      '<think>first I will plan this...</think>\n' +
      JSON.stringify(validManifestJson('run-x'));
    mockCreate.mockResolvedValue(reply(content));
    const m = await generateManifest(makeInput());
    expect(m.schema).toBe('compose.v1');
  });

  it('retries on malformed JSON and eventually succeeds', async () => {
    mockCreate
      .mockResolvedValueOnce(reply('not json at all'))
      .mockResolvedValueOnce(reply(JSON.stringify(validManifestJson('run-x'))));
    const m = await generateManifest(makeInput());
    expect(m.run_id).toBe('run-x');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('retries on schema-validation failure and eventually succeeds', async () => {
    const invalid = { ...validManifestJson('run-x'), schema: 'compose.v0' };
    mockCreate
      .mockResolvedValueOnce(reply(JSON.stringify(invalid)))
      .mockResolvedValueOnce(reply(JSON.stringify(validManifestJson('run-x'))));
    const m = await generateManifest(makeInput());
    expect(m.schema).toBe('compose.v1');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('propagates the last error after MAX_RETRIES attempts (3)', async () => {
    mockCreate.mockResolvedValue(reply('still not json'));
    await expect(generateManifest(makeInput())).rejects.toThrow(/not valid JSON/);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('propagates the last schema error after MAX_RETRIES attempts', async () => {
    mockCreate.mockResolvedValue(reply(JSON.stringify({ schema: 'compose.v0' })));
    await expect(generateManifest(makeInput())).rejects.toThrow(/schema validation failed/);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('throws a clear error when OPENROUTER_API_KEY is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    jest.resetModules();
    const mod = require('../../src/manifest/generator');
    await expect(mod.generateManifest(makeInput())).rejects.toThrow(
      /OPENROUTER_API_KEY/,
    );
  });

  it('honours OPENROUTER_MODEL env override', async () => {
    process.env.OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet';
    mockCreate.mockResolvedValue(reply(JSON.stringify(validManifestJson('run-x'))));
    await generateManifest(makeInput());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-3.5-sonnet' }),
    );
    delete process.env.OPENROUTER_MODEL;
  });

  it('falls back to the default model when OPENROUTER_MODEL unset', async () => {
    delete process.env.OPENROUTER_MODEL;
    mockCreate.mockResolvedValue(reply(JSON.stringify(validManifestJson('run-x'))));
    await generateManifest(makeInput());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'google/gemini-2.5-flash' }),
    );
  });
});
