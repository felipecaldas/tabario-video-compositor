/**
 * @jest-environment jsdom
 */

jest.mock('remotion', () => require('../helpers/remotion-mock'));

import '@testing-library/jest-dom';
import * as React from 'react';
import { render } from '@testing-library/react';
import { GraphicsPlateComposition } from '../../remotion/GraphicsPlateComposition';
import { buildGraphicsPlateSpecs } from '../../src/renderer/graphicsPlateSpecs';
import { TimelineManifest } from '../../src/timeline';

function timeline(overrides: Partial<TimelineManifest> = {}): TimelineManifest {
  return {
    schema: 'timeline.v1',
    source_schema: 'compose.v2',
    run_id: 'run-1',
    client_id: 'client-1',
    platform: 'tiktok',
    fps: 30,
    width: 720,
    height: 1280,
    duration_frames: 180,
    assets: [],
    layouts: [{
      id: 'layout:sequential',
      kind: 'sequential',
      regions: [{ id: 'main', x: 0, y: 0, width: 1, height: 1, z_index: 0 }],
    }],
    tracks: {
      video: [],
      audio: [],
      graphics: [
        {
          id: 'scene:0:graphics:kinetic_title:0',
          component: 'kinetic_title',
          scene_index: 0,
          start_frame: 30,
          duration_frames: 45,
          props: { text: 'Hook' },
          render_mode: 'transparent_plate',
        },
        {
          id: 'graphics:closing:end_card',
          component: 'end_card',
          start_frame: 120,
          duration_frames: 60,
          props: { cta: { text: 'Try Tabario' }, text: 'Try Tabario', showLogo: true },
          render_mode: 'full_frame_plate',
        },
      ],
    },
    transitions: [],
    outputs: [{
      id: 'final',
      filename: 'composed.mp4',
      container: 'mp4',
      video_codec: 'h264',
      audio_codec: 'aac',
      pixel_format: 'yuv420p',
    }],
    captions: {
      words: [{ word: 'Hello', start_frame: 0, end_frame: 15 }],
    },
    ...overrides,
  };
}

describe('buildGraphicsPlateSpecs', () => {
  it('creates deterministic graphics and caption plate specs', () => {
    const specs = buildGraphicsPlateSpecs({
      timeline: timeline(),
      outputDir: '/runs/run-1/plates',
    });

    expect(specs.map((spec) => spec.clipId)).toEqual([
      'scene:0:graphics:kinetic_title:0',
      'graphics:closing:end_card',
      'caption_track',
    ]);
    expect(specs[0]).toMatchObject({
      filename: 'scene-0-graphics-kinetic_title-0.mov',
      outputPath: '/runs/run-1/plates/scene-0-graphics-kinetic_title-0.mov',
      startFrame: 30,
      durationFrames: 45,
      renderMode: 'transparent_plate',
      plateType: 'graphics_clip',
    });
    expect(specs[1].renderMode).toBe('full_frame_plate');
    expect(specs[2]).toMatchObject({
      filename: 'caption-track.mov',
      startFrame: 0,
      durationFrames: 180,
      plateType: 'caption_track',
    });
  });

  it('omits caption plates when the timeline has no captions', () => {
    const specs = buildGraphicsPlateSpecs({
      timeline: timeline({ captions: undefined }),
      outputDir: '/runs/run-1/plates',
    });

    expect(specs.map((spec) => spec.clipId)).toEqual([
      'scene:0:graphics:kinetic_title:0',
      'graphics:closing:end_card',
    ]);
  });
});

describe('GraphicsPlateComposition', () => {
  it.each([
    ['kinetic_title', { text: 'Hook' }, 'Hook'],
    ['lower_third', { name: 'Ada Lovelace', subtitle: 'CEO' }, 'Ada Lovelace'],
    ['motion_badge', { text: 'New' }, 'New'],
    ['end_card', { cta: { text: 'Try Tabario' }, showLogo: true }, 'Try Tabario'],
  ] as const)('renders %s graphics clips without source video or audio', (component, props, expectedText) => {
    const manifest = timeline();
    const clip = {
      ...manifest.tracks.graphics[0],
      component,
      props,
    };
    const { container } = render(
      <GraphicsPlateComposition timeline={manifest} clip={clip} />,
    );

    expect(container.textContent).toContain(expectedText);
    expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="audio"]')).toHaveLength(0);
  });

  it('renders logo reveal graphics clips without source video or audio', () => {
    const manifest = timeline();
    const clip = {
      ...manifest.tracks.graphics[0],
      component: 'logo_reveal',
      props: {},
    };

    const { container } = render(
      <GraphicsPlateComposition timeline={manifest} clip={clip} />,
    );

    expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="audio"]')).toHaveLength(0);
  });

  it('renders caption plates from timeline captions', () => {
    const manifest = timeline();
    const { container } = render(
      <GraphicsPlateComposition timeline={manifest} plateType="caption_track" />,
    );

    expect(container.textContent).toContain('Hello');
    expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(0);
  });
});
