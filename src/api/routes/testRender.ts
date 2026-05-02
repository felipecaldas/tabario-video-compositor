import { Router, Request, Response } from 'express';
import { CompositionManifest, BrandProfile } from '../../types';
import { runTestRender, ManifestOverrides, runTestRenderFromRun, ManifestMode, AspectRatio } from '../../services/testRenderService';
import { TemplateRegistry } from '../../templates/registry';

export const testRenderRouter = Router();

function logRequestSummary(
  route: string,
  body: {
    run_id?: string;
    base_path?: string;
    platform?: string;
    manifest_mode?: string;
    aspect_ratio?: string;
    target_fps?: number;
    template_type?: string;
    style_id?: string;
    manifest?: CompositionManifest;
    brand_profile?: BrandProfile;
  },
): void {
  console.log(
    `[testRender] ${route} request: ` +
      `run_id=${body.run_id ?? '(missing)'}, ` +
      `base_path=${body.base_path ?? '(default)'}, ` +
      `platform=${body.platform ?? '(default)'}, ` +
      `manifest_mode=${body.manifest_mode ?? '(default)'}, ` +
      `aspect_ratio=${body.aspect_ratio ?? '(auto)'}, ` +
      `target_fps=${body.target_fps ?? '(auto)'}, ` +
      `template_type=${body.template_type ?? '(none)'}, ` +
      `style_id=${body.style_id ?? '(none)'}, ` +
      `manifest_supplied=${Boolean(body.manifest)}, ` +
      `brand_profile_supplied=${Boolean(body.brand_profile)}`,
  );
}

testRenderRouter.post('/', async (req: Request, res: Response) => {
  const { run_id, client_id, platform, manifest, overrides } = req.body as {
    run_id?: string;
    client_id?: string;
    platform?: string;
    manifest?: CompositionManifest;
    overrides?: ManifestOverrides;
  };

  logRequestSummary('/compose/test-render', { run_id, platform, manifest });

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
    generate_captions,
    style_id,
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
    generate_captions?: boolean;
    style_id?: string;
  };

  logRequestSummary('/compose/test-render/from-run', {
    run_id,
    base_path,
    platform,
    manifest_mode,
    aspect_ratio,
    target_fps,
    template_type,
    style_id,
    manifest,
    brand_profile,
  });

  if (generate_captions !== undefined) {
    console.log(`[testRender] generate_captions=${generate_captions}`);
  }

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
      generateCaptions: generate_captions,
      styleId: style_id,
    });
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') || message.includes('No clip') || message.includes('No voiceover') ? 400 : 500;
    res.status(status).json({ error: message, detail: String(err) });
  }
});
