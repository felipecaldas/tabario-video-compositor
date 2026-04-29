jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
}));

import { execFile } from 'child_process';
import { writeFile } from 'fs/promises';
import { validateFinalRender } from '../../src/renderer/finalValidation';

const mockExecFile = execFile as unknown as jest.Mock;
const mockWriteFile = writeFile as unknown as jest.Mock;

function queueProbe(payload: unknown): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: string, _args: string[], cb: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
      cb(null, { stdout: JSON.stringify(payload), stderr: '' });
    },
  );
}

function queueBlackDetect(stderr: string): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: string, _args: string[], cb: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
      cb(null, { stdout: '', stderr });
    },
  );
}

function validProbe(overrides: Record<string, unknown> = {}): unknown {
  return {
    streams: [
      {
        codec_type: 'video',
        width: 720,
        height: 1280,
        avg_frame_rate: '30000/1000',
        duration: '6.000000',
        ...overrides,
      },
      { codec_type: 'audio' },
    ],
    format: { duration: '6.000000' },
  };
}

function validationOptions() {
  return {
    outputPath: '/run/composed.mp4',
    reportPath: '/run/composed.validation.json',
    expected: {
      width: 720,
      height: 1280,
      fps: 30,
      durationSeconds: 6,
      requireAudio: true,
    },
  };
}

describe('validateFinalRender', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    mockWriteFile.mockReset().mockResolvedValue(undefined);
  });

  it('writes a successful validation report for matching video, audio, duration, and low black ratio', async () => {
    queueProbe(validProbe());
    queueBlackDetect('[blackdetect @ 0x1] black_start:0 black_end:0.25 black_duration:0.25');

    const report = await validateFinalRender(validationOptions());

    expect(report.ok).toBe(true);
    expect(report.probe).toEqual({
      hasVideo: true,
      hasAudio: true,
      width: 720,
      height: 1280,
      fps: 30,
      durationSeconds: 6,
    });
    expect(report.blackFrames.ratio).toBeCloseTo(0.25 / 6);
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/run/composed.validation.json',
      expect.stringContaining('"ok": true'),
      'utf8',
    );
  });

  it('fails and still writes a report when the output has no video stream', async () => {
    queueProbe({ streams: [{ codec_type: 'audio' }], format: { duration: '6.000000' } });
    queueBlackDetect('');

    await expect(validateFinalRender(validationOptions())).rejects.toThrow('missing video stream');

    expect(mockWriteFile).toHaveBeenCalledWith(
      '/run/composed.validation.json',
      expect.stringContaining('missing video stream'),
      'utf8',
    );
  });

  it('fails when required audio is missing', async () => {
    queueProbe({
      streams: [{
        codec_type: 'video',
        width: 720,
        height: 1280,
        avg_frame_rate: '30/1',
        duration: '6.000000',
      }],
      format: { duration: '6.000000' },
    });
    queueBlackDetect('');

    await expect(validateFinalRender(validationOptions())).rejects.toThrow('missing audio stream');
  });

  it('fails on resolution, fps, and duration mismatches', async () => {
    queueProbe(validProbe({
      width: 1080,
      height: 1920,
      avg_frame_rate: '25/1',
      duration: '9.500000',
    }));
    queueBlackDetect('');

    await expect(validateFinalRender(validationOptions())).rejects.toThrow(
      /width 1080.*height 1920.*fps 25.*duration 9.5s/,
    );
  });

  it('fails when blackdetect reports mostly black output', async () => {
    queueProbe(validProbe());
    queueBlackDetect('[blackdetect @ 0x1] black_start:0 black_end:5.9 black_duration:5.9');

    await expect(validateFinalRender(validationOptions())).rejects.toThrow(/black-frame ratio 0.983/);
  });

  it('uses ffprobe format duration when stream duration is absent', async () => {
    queueProbe(validProbe({ duration: undefined }));
    queueBlackDetect('');

    const report = await validateFinalRender(validationOptions());

    expect(report.probe.durationSeconds).toBe(6);
  });
});
