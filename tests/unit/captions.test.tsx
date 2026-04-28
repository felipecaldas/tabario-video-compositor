/**
 * @jest-environment jsdom
 */

jest.mock('remotion', () => require('../helpers/remotion-mock'));

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import * as remotionMock from '../helpers/remotion-mock';

import { BrandProvider } from '../../remotion/BrandContext';
import { StyleProvider } from '../../remotion/StyleContext';
import { CaptionTrack } from '../../remotion/components/captions/CaptionTrack';
import { TikTokBold } from '../../remotion/components/captions/styles/TikTokBold';
import { Karaoke } from '../../remotion/components/captions/styles/Karaoke';
import { Typewriter } from '../../remotion/components/captions/styles/Typewriter';
import { Neon } from '../../remotion/components/captions/styles/Neon';
import { StyleRegistry } from '../../src/styles/registry';
import { CaptionTrack as CaptionTrackData } from '../../src/types';
import { BrandProfile } from '../../src/types';

const minBrand: BrandProfile = { id: 'b', client_id: 'c' };

function makeTrack(words: Array<{ word: string; start_frame: number; end_frame: number }>): CaptionTrackData {
  return { words };
}

function wrap(node: React.ReactNode, styleId = 'tiktok_bold') {
  const style = StyleRegistry.resolve(styleId);
  return (
    <BrandProvider brand={minBrand}>
      <StyleProvider style={style}>{node}</StyleProvider>
    </BrandProvider>
  );
}

const sampleTrack = makeTrack([
  { word: 'Hello', start_frame: 0, end_frame: 15 },
  { word: 'world', start_frame: 16, end_frame: 30 },
  { word: 'this', start_frame: 31, end_frame: 45 },
]);

beforeEach(() => {
  (remotionMock.useVideoConfig as jest.Mock).mockReturnValue({
    fps: 30, durationInFrames: 90, width: 1080, height: 1920,
    id: 'TabarioComposition', defaultProps: {},
  });
});

// ─── CaptionTrack dispatcher ─────────────────────────────────────────────────

describe('CaptionTrack', () => {
  it('renders without error when track has words (tiktok_bold style)', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(5);
    expect(() => render(wrap(<CaptionTrack track={sampleTrack} />))).not.toThrow();
  });

  it('renders without error with karaoke style', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(5);
    expect(() => render(wrap(<CaptionTrack track={sampleTrack} />, 'neon_creator'))).not.toThrow();
  });

  it('renders without error with typewriter style', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(5);
    expect(() => render(wrap(<CaptionTrack track={sampleTrack} />, 'cinematic_storyteller'))).not.toThrow();
  });

  it('returns null / nothing when track is empty', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(5);
    const emptyTrack = makeTrack([]);
    const { container } = render(wrap(<CaptionTrack track={emptyTrack} />));
    expect(container.firstChild).toBeNull();
  });
});

// ─── TikTokBold ──────────────────────────────────────────────────────────────

describe('TikTokBold', () => {
  it('renders the active word at the current frame', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(5);
    render(wrap(<TikTokBold track={sampleTrack} />));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('shows the second word when frame is in its window', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(20);
    render(wrap(<TikTokBold track={sampleTrack} />));
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('returns null before the first word starts', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(-5);
    const { container } = render(wrap(<TikTokBold track={sampleTrack} />));
    expect(container.firstChild).toBeNull();
  });

  it('returns null after the last word ends', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(200);
    const { container } = render(wrap(<TikTokBold track={sampleTrack} />));
    expect(container.firstChild).toBeNull();
  });
});

// ─── Karaoke ─────────────────────────────────────────────────────────────────

describe('Karaoke', () => {
  it('renders visible words in the current group', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(5);
    render(wrap(<Karaoke track={sampleTrack} />, 'neon_creator'));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('returns null before the first word', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(-1);
    const { container } = render(wrap(<Karaoke track={sampleTrack} />, 'neon_creator'));
    expect(container.firstChild).toBeNull();
  });
});

// ─── Typewriter ───────────────────────────────────────────────────────────────

describe('Typewriter', () => {
  it('renders partially typed word at mid-word frame', () => {
    // Frame 7 is ~50% through the first word (0–15)
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(7);
    render(wrap(<Typewriter track={sampleTrack} />, 'cinematic_storyteller'));
    // Some characters of 'Hello' should be visible
    const el = document.body;
    expect(el.textContent).toMatch(/H/);
  });

  it('shows full first word after it completes', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(15);
    render(wrap(<Typewriter track={sampleTrack} />, 'cinematic_storyteller'));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('returns null after the last word ends', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(200);
    const { container } = render(wrap(<Typewriter track={sampleTrack} />, 'cinematic_storyteller'));
    expect(container.firstChild).toBeNull();
  });
});

// ─── Neon ─────────────────────────────────────────────────────────────────────

describe('Neon', () => {
  it('renders active word in the neon group', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(5);
    render(wrap(<Neon track={sampleTrack} />));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('returns null before first word', () => {
    (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(-1);
    const { container } = render(wrap(<Neon track={sampleTrack} />));
    expect(container.firstChild).toBeNull();
  });
});

// ─── transcribe() — frame-timing logic (unit, no API call) ───────────────────

describe('transcribe frame-timing conversion', () => {
  // Test the word-to-frame conversion logic in isolation by simulating
  // what transcribe() does with raw Whisper words.

  function wordsToFrames(
    raw: Array<{ word: string; start: number; end: number }>,
    fps = 30,
  ) {
    return raw.map((w) => ({
      word: w.word.trim(),
      start_frame: Math.round(w.start * fps),
      end_frame: Math.round(w.end * fps),
    }));
  }

  function detectPauses(
    raw: Array<{ word: string; start: number; end: number }>,
    fps = 30,
    threshold = 0.3,
  ) {
    const pauses: Array<{ start_frame: number; duration_frames: number }> = [];
    for (let i = 1; i < raw.length; i++) {
      const gap = raw[i].start - raw[i - 1].end;
      if (gap >= threshold) {
        pauses.push({
          start_frame: Math.round(raw[i - 1].end * fps),
          duration_frames: Math.round(gap * fps),
        });
      }
    }
    return pauses;
  }

  it('converts seconds to frames at 30fps', () => {
    const raw = [
      { word: 'Hello', start: 0.0, end: 0.5 },
      { word: 'world', start: 0.6, end: 1.0 },
    ];
    const words = wordsToFrames(raw, 30);
    expect(words[0].start_frame).toBe(0);
    expect(words[0].end_frame).toBe(15);
    expect(words[1].start_frame).toBe(18);
    expect(words[1].end_frame).toBe(30);
  });

  it('converts seconds to frames at 60fps', () => {
    const raw = [{ word: 'Hi', start: 1.0, end: 1.5 }];
    const words = wordsToFrames(raw, 60);
    expect(words[0].start_frame).toBe(60);
    expect(words[0].end_frame).toBe(90);
  });

  it('trims leading/trailing whitespace from word tokens', () => {
    const raw = [{ word: ' Hello ', start: 0, end: 0.5 }];
    const words = wordsToFrames(raw);
    expect(words[0].word).toBe('Hello');
  });

  it('detects pauses ≥ 0.3s between words', () => {
    const raw = [
      { word: 'Hello', start: 0.0, end: 0.5 },
      { word: 'world', start: 1.0, end: 1.5 }, // 0.5s gap → pause
    ];
    const pauses = detectPauses(raw);
    expect(pauses).toHaveLength(1);
    expect(pauses[0].start_frame).toBe(15); // end of 'Hello' at 0.5 * 30
    expect(pauses[0].duration_frames).toBe(15); // 0.5s * 30fps
  });

  it('does not record short gaps as pauses', () => {
    const raw = [
      { word: 'one', start: 0.0, end: 0.3 },
      { word: 'two', start: 0.5, end: 0.8 }, // 0.2s gap — below threshold
    ];
    const pauses = detectPauses(raw);
    expect(pauses).toHaveLength(0);
  });
});
