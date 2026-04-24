/**
 * Unit tests for runner helpers: flattenActivePlatformBrief, resolveCanonicalDimensions.
 *
 * These helpers are now exported from src/runner.ts so tests exercise the real
 * implementation rather than a hand-rolled copy.
 */

import {
  flattenActivePlatformBrief,
  resolveCanonicalDimensions,
} from '../../src/runner';
import { Brief } from '../../src/types';

// ─── flattenActivePlatformBrief ──────────────────────────────────────────────

function makeBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    title: 'Test Video',
    hook: 'Cross-platform hook',
    narrative_structure: 'problem-solution-CTA',
    visual_direction: {
      mood: 'optimistic',
      color_feel: 'warm pastels',
      shot_style: 'cinematic handheld',
      branding_elements: 'Tabario wordmark lower-third',
    },
    platform_briefs: [
      {
        platform: 'LinkedIn',
        hook: 'LinkedIn hook',
        tone: 'confident, conversational',
        aspect_ratio: '1:1',
        call_to_action: 'Book a demo',
        platform_notes: 'Keep it professional',
        scenes: [
          {
            scene_number: 1,
            spoken_line: 'Hello world',
            caption_text: 'Hello',
            duration_seconds: 3,
            visual_description: 'Founder at whiteboard',
          },
          {
            scene_number: 2,
            spoken_line: 'See the product',
            caption_text: 'Product',
            duration_seconds: 4,
            visual_description: 'Product demo on screen',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('flattenActivePlatformBrief', () => {
  it('forwards all visual_direction fields to the flattened brief', () => {
    const flat = flattenActivePlatformBrief(makeBrief(), 'LinkedIn');
    expect(flat.visual_direction?.mood).toBe('optimistic');
    expect(flat.visual_direction?.color_feel).toBe('warm pastels');
    expect(flat.visual_direction?.shot_style).toBe('cinematic handheld');
    expect(flat.visual_direction?.branding_elements).toBe(
      'Tabario wordmark lower-third',
    );
  });

  it('forwards partial visual_direction when only some fields are set', () => {
    const flat = flattenActivePlatformBrief(
      makeBrief({ visual_direction: { mood: 'urgent' } }),
      'LinkedIn',
    );
    expect(flat.visual_direction?.mood).toBe('urgent');
    expect(flat.visual_direction?.color_feel).toBeUndefined();
  });

  it('yields undefined visual_direction when brief has none', () => {
    const flat = flattenActivePlatformBrief(
      makeBrief({ visual_direction: undefined }),
      'LinkedIn',
    );
    expect(flat.visual_direction).toBeUndefined();
  });

  it('is case-insensitive when matching platform names', () => {
    const flat = flattenActivePlatformBrief(makeBrief(), 'linkedin');
    expect(flat.tone).toBe('confident, conversational');
  });

  it('forwards platform-specific fields alongside visual_direction', () => {
    const flat = flattenActivePlatformBrief(makeBrief(), 'LinkedIn');
    expect(flat.tone).toBe('confident, conversational');
    expect(flat.call_to_action).toBe('Book a demo');
    expect(flat.aspect_ratio).toBe('1:1');
    expect(flat.hook).toBe('LinkedIn hook');
    expect(flat.platform_notes).toBe('Keep it professional');
  });

  it('maps scenes correctly alongside visual_direction', () => {
    const flat = flattenActivePlatformBrief(makeBrief(), 'LinkedIn');
    expect(flat.scenes).toHaveLength(2);
    expect(flat.scenes![0].description).toBe('Founder at whiteboard');
    expect(flat.scenes![0].duration_seconds).toBe(3);
    expect(flat.scenes![1].description).toBe('Product demo on screen');
  });

  it('falls back to top-level brief when no matching platform brief', () => {
    const brief = makeBrief();
    const flat = flattenActivePlatformBrief(brief, 'TikTok');
    expect(flat).toBe(brief);
  });

  it('returns brief as-is when platform_briefs is empty', () => {
    const brief: Brief = {
      title: 'No platform briefs',
      visual_direction: { mood: 'calm' },
      platform_briefs: [],
    };
    const flat = flattenActivePlatformBrief(brief, 'LinkedIn');
    expect(flat).toBe(brief);
  });

  it('falls back to spoken_line when visual_description missing', () => {
    const brief = makeBrief();
    brief.platform_briefs![0].scenes[0].visual_description = '';
    const flat = flattenActivePlatformBrief(brief, 'LinkedIn');
    // visual_description is empty so description should fall back to spoken_line
    expect(flat.scenes![0].description).toBe('Hello world');
  });
});

// ─── resolveCanonicalDimensions ──────────────────────────────────────────────

describe('resolveCanonicalDimensions', () => {
  it('resolves legacy 720p key for portrait 9:16', () => {
    expect(resolveCanonicalDimensions('9:16', '720p')).toEqual({
      width: 720,
      height: 1280,
    });
  });

  it('resolves legacy 1080p key for portrait 9:16', () => {
    expect(resolveCanonicalDimensions('9:16', '1080p')).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it('resolves legacy 480p key for portrait 9:16', () => {
    expect(resolveCanonicalDimensions('9:16', '480p')).toEqual({
      width: 480,
      height: 854,
    });
  });

  it('swaps dimensions for 16:9 landscape', () => {
    expect(resolveCanonicalDimensions('16:9', '720p')).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it('uses shorter side twice for 1:1 square', () => {
    expect(resolveCanonicalDimensions('1:1', '720p')).toEqual({
      width: 720,
      height: 720,
    });
  });

  it('accepts WxH string like 1080x1920', () => {
    expect(resolveCanonicalDimensions('9:16', '1080x1920')).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it('accepts WxH string like 720x1280', () => {
    expect(resolveCanonicalDimensions('9:16', '720x1280')).toEqual({
      width: 720,
      height: 1280,
    });
  });

  it('ignores video_format when WxH explicitly provided', () => {
    // WxH is authoritative: 9:16 does NOT swap 1920x1080 → 1080x1920
    expect(resolveCanonicalDimensions('9:16', '1920x1080')).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it('falls back to 720p portrait with warning for unknown input', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveCanonicalDimensions('9:16', 'nonsense');
    expect(result).toEqual({ width: 720, height: 1280 });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown target_resolution'),
    );
    warn.mockRestore();
  });

  it('falls back to 720p portrait for empty input', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveCanonicalDimensions('9:16', '');
    expect(result).toEqual({ width: 720, height: 1280 });
    warn.mockRestore();
  });
});
