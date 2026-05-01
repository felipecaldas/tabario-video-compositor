import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { ComposeJob, HandoffPayload, JobStatus } from '../../types';
import { runComposeJob } from '../../runner';

export const composeRouter = Router();

// In-memory job store (suitable for single-instance deployment)
const jobs = new Map<string, ComposeJob>();

const HandoffPayloadSchema = z.object({
  run_id: z.string().min(1),
  client_id: z.string().min(1),
  brief: z.record(z.unknown()),
  platform: z.string().min(1),
  voiceover_path: z.string().min(1),
  clip_paths: z.array(z.string()).min(1),
  video_format: z.string().default('mp4'),
  target_resolution: z.string().default('1080x1920'),
  target_fps: z.number().int().positive().optional(),
  video_idea_id: z.string().optional(),
  workflow_id: z.string().optional(),
  user_access_token: z.string().min(1, 'user_access_token is required'),
  generate_captions: z.boolean().optional(),
  style_id: z.string().optional(),
  use_case: z.string().optional(),
});

/** POST /compose/start — Accept handoff from edit-videos, enqueue compose job */
composeRouter.post('/start', async (req: Request, res: Response) => {
  const parsed = HandoffPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const payload = parsed.data as HandoffPayload;
  const job: ComposeJob = {
    id: uuidv4(),
    run_id: payload.run_id,
    client_id: payload.client_id,
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
  };

  jobs.set(job.id, job);

  // Run async — do not await
  runComposeJob(job, payload, (update) => {
    const existing = jobs.get(job.id);
    if (existing) {
      jobs.set(job.id, { ...existing, ...update, updated_at: new Date() });
    }
  }).catch((err: Error) => {
    const existing = jobs.get(job.id);
    if (existing) {
      jobs.set(job.id, { ...existing, status: 'failed', error: err.message, updated_at: new Date() });
    }
  });

  return res.status(202).json({ compose_job_id: job.id, status: job.status });
});

/** GET /compose/:id — Poll job status */
composeRouter.get('/:id', (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json({
    compose_job_id: job.id,
    run_id: job.run_id,
    status: job.status,
    final_video_path: job.final_video_path,
    validation_report_path: job.validation_report_path,
    engagement_report_path: job.engagement_report_path,
    output_url: job.output_url,
    error: job.error,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
});

/** GET /compose/:id/manifest — Debug: inspect generated manifest */
composeRouter.get('/:id/manifest', (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (!job.manifest) {
    return res.status(404).json({ error: 'Manifest not yet generated', status: job.status });
  }
  return res.json(job.manifest);
});

export function getJobStatus(id: string): JobStatus | null {
  return jobs.get(id)?.status ?? null;
}

export function getJob(id: string): ComposeJob | null {
  return jobs.get(id) ?? null;
}
