import { Router, Request, Response } from 'express';
import { CompositionManifest } from '../../types';
import { runTestRender, ManifestOverrides } from '../../services/testRenderService';

export const testRenderRouter = Router();

testRenderRouter.post('/', async (req: Request, res: Response) => {
  const { run_id, client_id, platform, manifest, overrides } = req.body as {
    run_id?: string;
    client_id?: string;
    platform?: string;
    manifest?: CompositionManifest;
    overrides?: ManifestOverrides;
  };

  if (!run_id || typeof run_id !== 'string') {
    res.status(400).json({ error: 'run_id is required', detail: 'Provide run_id in the request body' });
    return;
  }

  try {
    const result = await runTestRender({
      runId: run_id,
      clientId: client_id,
      platform,
      manifest,
      overrides,
    });
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') || message.includes('No clip') || message.includes('No voiceover') ? 400 : 500;
    res.status(status).json({ error: message, detail: String(err) });
  }
});
