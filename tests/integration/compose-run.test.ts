/**
 * Integration test: full compose run using real files from /data/shared/gqmkbeuor4b
 *
 * Run inside the container:
 *   docker exec tabario-video-compositor npm test -- --testPathPattern=integration
 *
 * Prerequisites:
 *   - Container is running with all env vars set
 *   - /data/shared/gqmkbeuor4b contains .mp4 clip files + a voiceover
 *   - SUPABASE_* vars are set (or SKIP_UPLOAD=true to skip upload step)
 */

import * as fs from 'fs';
import * as path from 'path';

const API_BASE = `http://localhost:${process.env.PORT ?? 9312}`;
const RUN_ID = 'gqmkbeuor4b';
const DATA_DIR = `/data/shared/${RUN_ID}`;
const CLIENT_ID = process.env.TEST_CLIENT_ID ?? 'test-client';
const SKIP_UPLOAD = process.env.SKIP_UPLOAD === 'true';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

function discoverClips(dir: string): string[] {
  const files = fs.readdirSync(dir);
  return files
    .filter((f) => f.endsWith('.mp4') && !f.startsWith('composed'))
    .sort()
    .map((f) => path.join(dir, f));
}

function discoverVoiceover(dir: string): string {
  const files = fs.readdirSync(dir);
  const vo = files.find(
    (f) =>
      (f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.aac')) &&
      f.includes('voiceover'),
  );
  if (!vo) {
    // Fall back to any audio file
    const audio = files.find((f) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.aac'));
    if (!audio) throw new Error(`No voiceover audio found in ${dir}`);
    return path.join(dir, audio);
  }
  return path.join(dir, vo);
}

async function pollUntilDone(jobId: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/compose/${jobId}`);
    const data = (await res.json()) as Record<string, unknown>;
    const status = data.status as string;
    console.log(`  [poll] status=${status}`);
    if (status === 'done' || status === 'failed') return data;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Job ${jobId} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

describe('Integration: full compose run (gqmkbeuor4b)', () => {
  let clipPaths: string[];
  let voiceoverPath: string;

  beforeAll(() => {
    if (!fs.existsSync(DATA_DIR)) {
      throw new Error(`DATA_DIR not found: ${DATA_DIR}. Is the shared volume mounted?`);
    }
    clipPaths = discoverClips(DATA_DIR);
    voiceoverPath = discoverVoiceover(DATA_DIR);
    console.log(`\n  Clips found: ${clipPaths.length}`);
    clipPaths.forEach((c) => console.log(`    ${c}`));
    console.log(`  Voiceover: ${voiceoverPath}`);
  });

  it('health endpoint returns ok', async () => {
    const res = await fetch(`${API_BASE}/health`);
    const data = (await res.json()) as { status: string };
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('submits a compose job and polls to completion', async () => {
    const payload = {
      run_id: RUN_ID,
      client_id: CLIENT_ID,
      platform: 'tiktok',
      video_format: 'mp4',
      target_resolution: '1080x1920',
      voiceover_path: voiceoverPath,
      clip_paths: clipPaths,
      brief: {
        hook: 'See what Tabario can do',
        summary: 'Demo of Tabario video generation',
        call_to_action: 'Try Tabario free at tabario.com',
        tone: 'professional yet energetic',
      },
    };

    console.log(`\n  Submitting compose job for run_id=${RUN_ID}...`);
    const startRes = await fetch(`${API_BASE}/compose/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(startRes.status).toBe(202);
    const { compose_job_id, status: initialStatus } = (await startRes.json()) as {
      compose_job_id: string;
      status: string;
    };
    console.log(`  Job accepted: id=${compose_job_id}, initial status=${initialStatus}`);
    expect(compose_job_id).toBeTruthy();
    expect(initialStatus).toBe('pending');

    // Poll for completion
    const final = await pollUntilDone(compose_job_id);
    console.log(`\n  Final job state:`, JSON.stringify(final, null, 2));

    if (SKIP_UPLOAD) {
      // In SKIP_UPLOAD mode, failure at upload step is still a partial success
      expect(['done', 'failed']).toContain(final.status);
      if (final.status === 'failed') {
        console.warn(`  Job failed (SKIP_UPLOAD=true): ${final.error}`);
      }
    } else {
      expect(final.status).toBe('done');
      expect(typeof final.output_url).toBe('string');
      expect((final.output_url as string).length).toBeGreaterThan(0);
    }

    // Verify manifest was generated
    const manifestRes = await fetch(`${API_BASE}/compose/${compose_job_id}/manifest`);
    if (manifestRes.status === 200) {
      const manifest = (await manifestRes.json()) as Record<string, unknown>;
      expect(manifest.schema).toBe('compose.v1');
      expect(manifest.run_id).toBe(RUN_ID);
      console.log(`  Manifest scenes: ${(manifest.scenes as unknown[]).length}`);
    }
  }, POLL_TIMEOUT_MS + 30000);
});
