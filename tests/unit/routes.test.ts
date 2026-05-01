/**
 * Unit tests for POST /compose/start, GET /compose/:id and GET /compose/:id/manifest.
 * The real runner is mocked so submissions return instantly and we can drive the
 * in-memory job store deterministically from test code.
 */

jest.mock('../../src/runner', () => ({
  runComposeJob: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import { composeRouter, getJob, getJobStatus } from '../../src/api/routes/compose';
import * as runner from '../../src/runner';

const mockedRunner = runner as unknown as { runComposeJob: jest.Mock };

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/compose', composeRouter);
  return app;
}

const VALID_PAYLOAD = {
  run_id: 'run-abc',
  client_id: 'client-1',
  brief: { hook: 'x' },
  platform: 'tiktok',
  voiceover_path: '/data/shared/run-abc/voiceover.mp3',
  clip_paths: ['/data/shared/run-abc/c0.mp4'],
  video_format: '9:16',
  target_resolution: '720p',
  user_access_token: 'jwt-abc',
  use_case: 'ad',
  generate_captions: true,
};

describe('POST /compose/start', () => {
  beforeEach(() => {
    mockedRunner.runComposeJob.mockReset();
    mockedRunner.runComposeJob.mockResolvedValue(undefined);
  });

  it('returns 400 on an empty body', async () => {
    const res = await request(makeApp()).post('/compose/start').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
    expect(res.body.details).toBeDefined();
  });

  it('returns 400 when clip_paths is empty', async () => {
    const res = await request(makeApp())
      .post('/compose/start')
      .send({ ...VALID_PAYLOAD, clip_paths: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when user_access_token missing', async () => {
    const { user_access_token, ...payload } = VALID_PAYLOAD;
    const res = await request(makeApp()).post('/compose/start').send(payload);
    expect(res.status).toBe(400);
  });

  it('returns 202 with a compose_job_id on valid payload', async () => {
    const res = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    expect(res.status).toBe(202);
    expect(typeof res.body.compose_job_id).toBe('string');
    expect(res.body.status).toBe('pending');
    expect(mockedRunner.runComposeJob).toHaveBeenCalledTimes(1);
  });

  it('passes run_id and client_id through to the runner', async () => {
    await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    const [, payloadArg] = mockedRunner.runComposeJob.mock.calls[0];
    expect(payloadArg.run_id).toBe('run-abc');
    expect(payloadArg.client_id).toBe('client-1');
    expect(payloadArg.use_case).toBe('ad');
    expect(payloadArg.generate_captions).toBe(true);
  });

  it('captures runner exceptions into the job store without bubbling', async () => {
    mockedRunner.runComposeJob.mockRejectedValueOnce(new Error('boom'));
    const res = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    expect(res.status).toBe(202);
    // Allow the rejected promise to settle
    await new Promise((r) => setImmediate(r));
    const follow = await request(makeApp()).get(`/compose/${res.body.compose_job_id}`);
    expect(follow.body.status).toBe('failed');
    expect(follow.body.error).toBe('boom');
  });
});

describe('GET /compose/:id', () => {
  beforeEach(() => {
    mockedRunner.runComposeJob.mockReset();
    mockedRunner.runComposeJob.mockResolvedValue(undefined);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(makeApp()).get('/compose/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });

  it('reflects status updates applied by the runner', async () => {
    // Wire the mock to call onUpdate synchronously
    mockedRunner.runComposeJob.mockImplementation(async (_job, _payload, onUpdate) => {
      onUpdate({ status: 'rendering' });
    });
    const submit = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    await new Promise((r) => setImmediate(r));
    const res = await request(makeApp()).get(`/compose/${submit.body.compose_job_id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rendering');
    expect(res.body.run_id).toBe('run-abc');
  });

  it('returns final_video_path when the runner marks the job done', async () => {
    mockedRunner.runComposeJob.mockImplementation(async (_job, _payload, onUpdate) => {
      onUpdate({
        status: 'done',
        final_video_path: '/data/shared/run-abc/composed.mp4',
        validation_report_path: '/data/shared/run-abc/composed.validation.json',
        engagement_report_path: '/data/shared/run-abc/engagement.validation.json',
      });
    });
    const submit = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    await new Promise((r) => setImmediate(r));
    const res = await request(makeApp()).get(`/compose/${submit.body.compose_job_id}`);
    expect(res.body.status).toBe('done');
    expect(res.body.final_video_path).toBe('/data/shared/run-abc/composed.mp4');
    expect(res.body.validation_report_path).toBe('/data/shared/run-abc/composed.validation.json');
    expect(res.body.engagement_report_path).toBe('/data/shared/run-abc/engagement.validation.json');
  });
});

describe('GET /compose/:id/manifest', () => {
  beforeEach(() => {
    mockedRunner.runComposeJob.mockReset();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(makeApp()).get('/compose/nope/manifest');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });

  it('returns 404 until the manifest is generated', async () => {
    mockedRunner.runComposeJob.mockResolvedValue(undefined);
    const submit = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    const res = await request(makeApp()).get(`/compose/${submit.body.compose_job_id}/manifest`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Manifest not yet generated');
  });

  it('returns 404 with the current job status when manifest not yet produced', async () => {
    mockedRunner.runComposeJob.mockResolvedValue(undefined);
    const submit = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    const res = await request(makeApp()).get(`/compose/${submit.body.compose_job_id}/manifest`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('status');
  });

  it('returns the manifest once the runner has produced one', async () => {
    const manifest = {
      schema: 'compose.v1',
      client_id: 'client-1',
      run_id: 'run-abc',
      platform: 'tiktok',
      fps: 30,
      width: 720,
      height: 1280,
      duration_frames: 90,
      scenes: [],
      transitions: [],
      overlays: [],
      audio_track: { voiceover_filename: 'v.mp3', lufs_target: -16, music_ducking_db: -12 },
      closing: {
        component: 'end_card',
        cta: { text: 'Go' },
        show_logo: true,
        start_frame: 60,
        duration_frames: 30,
      },
    };
    mockedRunner.runComposeJob.mockImplementation(async (_job, _payload, onUpdate) => {
      onUpdate({ manifest });
    });
    const submit = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    await new Promise((r) => setImmediate(r));
    const res = await request(makeApp()).get(`/compose/${submit.body.compose_job_id}/manifest`);
    expect(res.status).toBe(200);
    expect(res.body.schema).toBe('compose.v1');
    expect(res.body.run_id).toBe('run-abc');
  });
});

describe('getJob / getJobStatus helpers', () => {
  it('getJobStatus returns null for unknown job id', () => {
    expect(getJobStatus('nonexistent')).toBeNull();
  });

  it('getJob returns null for unknown job id', () => {
    expect(getJob('nonexistent')).toBeNull();
  });

  it('getJobStatus returns the status string for a known job', async () => {
    const submit = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    const status = getJobStatus(submit.body.compose_job_id);
    expect(status).toBe('pending');
  });

  it('getJob returns the full job object for a known job', async () => {
    const submit = await request(makeApp()).post('/compose/start').send(VALID_PAYLOAD);
    const job = getJob(submit.body.compose_job_id);
    expect(job).not.toBeNull();
    expect(job?.id).toBe(submit.body.compose_job_id);
    expect(job?.status).toBe('pending');
  });
});
