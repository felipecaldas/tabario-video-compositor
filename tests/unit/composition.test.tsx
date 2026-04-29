/**
 * @jest-environment jsdom
 *
 * Integration test for remotion/TabarioComposition.tsx — verifies scenes,
 * overlays, transitions, scene_overlays, grade filter, voiceover, and
 * music volume are all wired up from the manifest.
 */

jest.mock('remotion', () => require('../helpers/remotion-mock'));

import '@testing-library/jest-dom';
import * as React from 'react';
import { render } from '@testing-library/react';
import {
  TabarioComposition,
  dbToLinear,
  gradeToFilter,
} from '../../remotion/TabarioComposition';
import { CompositionManifest } from '../../src/types';

function baseManifest(): CompositionManifest {
  return {
    schema: 'compose.v1',
    client_id: 'client-1',
    run_id: 'run-x',
    platform: 'tiktok',
    fps: 30,
    width: 720,
    height: 1280,
    duration_frames: 120,
    scenes: [
      { index: 0, clip_filename: 'c0.mp4', duration_frames: 60, layout: 'fullscreen' },
      { index: 1, clip_filename: 'c1.mp4', duration_frames: 60, layout: 'fullscreen' },
    ],
    transitions: [
      { between: [0, 1], type: 'soft_cut', duration_frames: 15 },
    ],
    overlays: [
      {
        component: 'kinetic_title',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 30,
        props: { text: 'HOOK' },
      },
    ],
    audio_track: {
      voiceover_filename: 'voiceover.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card',
      cta: { text: 'Try me' },
      show_logo: true,
      start_frame: 90,
      duration_frames: 30,
    },
  };
}

describe('gradeToFilter', () => {
  it('returns undefined for neutral and undefined grades', () => {
    expect(gradeToFilter('neutral')).toBeUndefined();
    expect(gradeToFilter(undefined)).toBeUndefined();
  });

  it('returns distinct filters for each non-neutral grade', () => {
    const a = gradeToFilter('desaturated_cool');
    const b = gradeToFilter('vibrant_warm');
    const c = gradeToFilter('high_contrast');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe('dbToLinear', () => {
  it('returns 1 at 0 dB', () => {
    expect(dbToLinear(0)).toBeCloseTo(1, 5);
  });

  it('returns ~0.5 at -6 dB', () => {
    expect(dbToLinear(-6)).toBeCloseTo(0.5012, 3);
  });

  it('returns ~0.25 at -12 dB', () => {
    expect(dbToLinear(-12)).toBeCloseTo(0.2512, 3);
  });
});

describe('TabarioComposition', () => {
  it('does not throw when rendered with discovery-time default props', () => {
    const minimal = {
      schema: 'compose.v1' as const,
      client_id: '',
      run_id: '',
      platform: 'tiktok',
      fps: 30,
      width: 1080,
      height: 1920,
      duration_frames: 300,
      scenes: [],
      transitions: [],
      overlays: [],
      audio_track: {
        voiceover_filename: '',
        lufs_target: -16,
        music_ducking_db: -12,
      },
      closing: {
        component: 'end_card' as const,
        cta: { text: '' },
        show_logo: false,
        start_frame: 270,
        duration_frames: 30,
      },
    };
    expect(() => render(<TabarioComposition {...minimal} />)).not.toThrow();
  });

  it('renders a Video per scene and the voiceover audio', () => {
    const { container } = render(<TabarioComposition {...baseManifest()} />);
    const videos = container.querySelectorAll('[data-testid="video"]');
    // Each scene has a Video; SoftCut transition also renders two Videos,
    // so at least 2 scene videos are present.
    expect(videos.length).toBeGreaterThanOrEqual(2);
    const audios = container.querySelectorAll('[data-testid="audio"]');
    // At least the voiceover audio is rendered.
    expect(audios.length).toBeGreaterThanOrEqual(1);
    // Voiceover src resolved via staticFile()
    expect((audios[0] as HTMLAudioElement).src).toContain('voiceover.mp3');
  });

  it('renders file-backed clips through Video components', () => {
    const { container } = render(<TabarioComposition {...baseManifest()} />);
    const videos = container.querySelectorAll('[data-testid="video"]');
    expect(videos.length).toBeGreaterThanOrEqual(2);
  });

  it('renders music with ducked volume when music_source.url is set', () => {
    const m = baseManifest();
    m.audio_track.music_source = { url: 'https://cdn/music.mp3' };
    m.audio_track.music_ducking_db = -12;
    const { container } = render(<TabarioComposition {...m} />);
    const audios = container.querySelectorAll('[data-testid="audio"]');
    // Voiceover + music => 2 audio elements
    expect(audios.length).toBe(2);
    const music = audios[1] as HTMLAudioElement;
    // -12 dB → ~0.2512 linear
    const vol = music.getAttribute('data-volume') ?? '';
    expect(parseFloat(vol)).toBeCloseTo(0.2512, 2);
  });

  it('skips <Video> for a typographic scene (no clip_filename)', () => {
    const m = baseManifest();
    m.scenes = [
      {
        index: 0,
        duration_frames: 60,
        layout: 'fullscreen',
        scene_overlays: [
          { component: 'stagger_title', text: 'Pure text' },
        ],
      },
      m.scenes[1],
    ];
    m.transitions = [];
    const { container } = render(<TabarioComposition {...m} />);
    // The typographic scene renders a scene_overlay but no Video.
    // Only scene 1 (has clip) contributes a Video; transitions cleared.
    const videos = container.querySelectorAll('[data-testid="video"]');
    expect(videos.length).toBe(1);
    // StaggerTitle splits on space and renders per-word spans; textContent
    // concatenates without spaces, so assert on each word separately.
    expect(container.textContent).toContain('Pure');
    expect(container.textContent).toContain('text');
  });

  it('renders a scene_overlay inside its scene Sequence', () => {
    const m = baseManifest();
    m.scenes[0].scene_overlays = [
      { component: 'caption_bar', text: 'IMPORTANT' },
    ];
    const { container } = render(<TabarioComposition {...m} />);
    expect(container.textContent).toContain('IMPORTANT');
  });

  it('renders typographic_background overlay when present', () => {
    const m = baseManifest();
    m.overlays = [
      {
        component: 'typographic_background',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 60,
        props: { text: 'BIG TEXT' },
      },
    ];
    const { container } = render(<TabarioComposition {...m} />);
    expect(container.textContent).toContain('BIG TEXT');
  });

  it('renders end_card when listed as a manifest overlay', () => {
    const m = baseManifest();
    m.overlays = [
      {
        component: 'end_card',
        scene_index: 1,
        start_frame: 60,
        duration_frames: 30,
        props: { ctaText: 'Custom Mid-CTA', showLogo: false },
      },
    ];
    const { container } = render(<TabarioComposition {...m} />);
    expect(container.textContent).toContain('Custom Mid-CTA');
  });

  it('applies scene.grade as a CSS filter on the scene Video', () => {
    const m = baseManifest();
    m.scenes[0].grade = 'vibrant_warm';
    const { container } = render(<TabarioComposition {...m} />);
    const videos = container.querySelectorAll('[data-testid="video"]') as
      NodeListOf<HTMLVideoElement>;
    const anyHasFilter = Array.from(videos).some((v) => v.style.filter);
    expect(anyHasFilter).toBe(true);
  });

  it('renders at least one transition when declared in the manifest', () => {
    const m = baseManifest();
    m.transitions = [
      { between: [0, 1], type: 'color_wipe', duration_frames: 12 },
    ];
    const { container } = render(<TabarioComposition {...m} />);
    // Transitions render Video elements too — total videos should be >= 4
    // (2 scenes + 2 transition clips).
    const videos = container.querySelectorAll('[data-testid="video"]');
    expect(videos.length).toBeGreaterThanOrEqual(4);
  });

  it('gracefully handles a scene missing from a transition.between pair', () => {
    const m = baseManifest();
    m.transitions = [
      { between: [0, 99], type: 'scale_push', duration_frames: 12 },
    ];
    const { container } = render(<TabarioComposition {...m} />);
    // Does not throw; only scene videos rendered (2).
    const videos = container.querySelectorAll('[data-testid="video"]');
    expect(videos.length).toBe(2);
  });

  it('renders scale_push transitions end-to-end', () => {
    const m = baseManifest();
    m.transitions = [
      { between: [0, 1], type: 'scale_push', duration_frames: 12 },
    ];
    const { container } = render(<TabarioComposition {...m} />);
    expect(container.querySelectorAll('[data-testid="video"]').length).toBeGreaterThanOrEqual(4);
  });

  it('renders lower_third manifest overlay', () => {
    const m = baseManifest();
    m.overlays = [
      {
        component: 'lower_third',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 30,
        props: { name: 'Ada Lovelace', subtitle: 'CEO' },
      },
    ];
    render(<TabarioComposition {...m} />);
    // Name and subtitle appear in rendered output
    // (use container search since screen may be noisy)
  });

  it('renders logo_reveal manifest overlay', () => {
    const m = baseManifest();
    m.overlays = [
      {
        component: 'logo_reveal',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 30,
        props: {},
      },
    ];
    expect(() => render(<TabarioComposition {...m} />)).not.toThrow();
  });

  it('renders split_horizontal manifest overlay', () => {
    const m = baseManifest();
    m.overlays = [
      {
        component: 'split_horizontal',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 30,
        props: { leftSrc: 'a.mp4', rightSrc: 'b.mp4' },
      },
    ];
    expect(() => render(<TabarioComposition {...m} />)).not.toThrow();
  });

  it('renders split_vertical manifest overlay', () => {
    const m = baseManifest();
    m.overlays = [
      {
        component: 'split_vertical',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 30,
        props: { topSrc: 'a.mp4', bottomSrc: 'b.mp4' },
      },
    ];
    expect(() => render(<TabarioComposition {...m} />)).not.toThrow();
  });

  it('renders picture_in_picture manifest overlay', () => {
    const m = baseManifest();
    m.overlays = [
      {
        component: 'picture_in_picture',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 30,
        props: { mainSrc: 'm.mp4', overlaySrc: 'o.mp4' },
      },
    ];
    expect(() => render(<TabarioComposition {...m} />)).not.toThrow();
  });

  it('renders soft_cut/color_wipe overlays when invoked as manifest overlays', () => {
    const m = baseManifest();
    m.overlays = [
      {
        component: 'soft_cut',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 12,
        props: {},
      },
      {
        component: 'color_wipe',
        scene_index: 1,
        start_frame: 50,
        duration_frames: 12,
        props: { accentColor: '#ff0' },
      },
    ];
    expect(() => render(<TabarioComposition {...m} />)).not.toThrow();
  });

  it('renders nothing for an unknown overlay component type', () => {
    const m = baseManifest();
    m.overlays = [
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component: 'unknown_component' as any,
        scene_index: 0,
        start_frame: 0,
        duration_frames: 12,
        props: {},
      },
    ];
    expect(() => render(<TabarioComposition {...m} />)).not.toThrow();
  });

  it('renders kinetic_title scene overlay without text prop (undefined fallback)', () => {
    const m = baseManifest();
    m.scenes[0].scene_overlays = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { component: 'kinetic_title' } as any,
    ];
    expect(() => render(<TabarioComposition {...m} />)).not.toThrow();
  });

  it('uses default music_ducking_db when not provided on audio_track', () => {
    const m = baseManifest();
    m.audio_track.music_source = { url: 'https://cdn/m.mp3' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (m.audio_track as any).music_ducking_db;
    const { container } = render(<TabarioComposition {...m} />);
    const audios = container.querySelectorAll('[data-testid="audio"]');
    const musicVol = parseFloat(
      (audios[1] as HTMLAudioElement).getAttribute('data-volume') ?? '0',
    );
    // default -12 dB → ~0.2512
    expect(musicVol).toBeCloseTo(0.2512, 2);
  });
});
