import { Router, Request, Response } from 'express';
import { CompositionManifest, BrandProfile } from '../../types';
import { runTestRender, ManifestOverrides, runTestRenderFromRun, ManifestMode, AspectRatio } from '../../services/testRenderService';
import { TemplateRegistry } from '../../templates/registry';

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

testRenderRouter.post('/from-run', async (req: Request, res: Response) => {
  const {
    run_id,
    client_id,
    base_path,
    platform,
    aspect_ratio,
    manifest_mode,
    manifest,
    brand_profile,
    target_fps,
    template_type,
  } = req.body as {
    run_id?: string;
    client_id?: string;
    base_path?: string;
    platform?: string;
    aspect_ratio?: AspectRatio;
    manifest_mode?: ManifestMode;
    manifest?: CompositionManifest;
    brand_profile?: BrandProfile;
    target_fps?: number;
    template_type?: string;
  };

  if (!run_id || typeof run_id !== 'string') {
    res.status(400).json({ error: 'run_id is required', detail: 'Provide run_id in the request body' });
    return;
  }

  if (template_type !== undefined && !TemplateRegistry.isValid(template_type)) {
    const available = TemplateRegistry.list().map((t) => t.id).join(', ');
    res.status(400).json({
      error: `Unknown template_type '${template_type}'`,
      detail: `Available templates: ${available}`,
    });
    return;
  }

  try {
    const result = await runTestRenderFromRun({
      runId: run_id,
      clientId: client_id,
      basePath: base_path,
      platform,
      aspectRatio: aspect_ratio,
      manifestMode: manifest_mode ?? 'stub',
      manifest,
      brandProfile: brand_profile,
      targetFps: target_fps,
      templateType: template_type,
    });
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') || message.includes('No clip') || message.includes('No voiceover') ? 400 : 500;
    res.status(status).json({ error: message, detail: String(err) });
  }
});
