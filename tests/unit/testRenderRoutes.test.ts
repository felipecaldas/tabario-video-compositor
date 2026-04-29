/**
 * Unit tests for POST /compose/test-render and POST /compose/test-render/from-run.
 * The service layer is mocked so the route can be exercised without rendering.
 */

jest.mock('../../src/services/testRenderService', () => ({
  runTestRender: jest.fn(),
  runTestRenderFromRun: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import { testRenderRouter } from '../../src/api/routes/testRender';
import * as testRenderService from '../../src/services/testRenderService';

const mockedService = testRenderService as unknown as {
  runTestRender: jest.Mock;
  runTestRenderFromRun: jest.Mock;
};

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/compose/test-render', testRenderRouter);
  return app;
}

describe('POST /compose/test-render/from-run', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedService.runTestRender.mockReset();
    mockedService.runTestRenderFromRun.mockReset();
    mockedService.runTestRenderFromRun.mockResolvedValue({
      outputPath: '/data/shared/run-abc/test_render.mp4',
      durationMs: 123,
    });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs a request summary before handing off to the service', async () => {
    const res = await request(makeApp())
      .post('/compose/test-render/from-run')
      .send({
        run_id: 'run-abc',
        client_id: 'client-1',
        base_path: '/data/shared',
        platform: 'tiktok',
        aspect_ratio: '16:9',
        manifest_mode: 'stub',
        target_fps: 24,
        template_type: 'ad',
        manifest: { schema: 'compose.v1' },
        brand_profile: { id: 'bp-1', client_id: 'client-1' },
      });

    expect(res.status).toBe(200);
    expect(mockedService.runTestRenderFromRun).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[testRender] /compose/test-render/from-run request: run_id=run-abc'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('manifest_supplied=true'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('brand_profile_supplied=true'),
    );
  });
});
