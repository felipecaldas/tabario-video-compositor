/**
 * @jest-environment jsdom
 *
 * Render-level tests for every Remotion component under remotion/.
 * Uses a lightweight `remotion` mock (see ../helpers/remotion-mock.tsx)
 * so jsdom can drive the components without Remotion's renderer.
 */

jest.mock('remotion', () => require('../helpers/remotion-mock'));

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import * as remotionMock from '../helpers/remotion-mock';

import { BrandProvider, useBrand } from '../../remotion/BrandContext';
import { KineticTitle } from '../../remotion/components/KineticTitle';
import { StaggerTitle } from '../../remotion/components/StaggerTitle';
import { CaptionBar } from '../../remotion/components/CaptionBar';
import { LowerThird } from '../../remotion/components/LowerThird';
import { LogoReveal } from '../../remotion/components/LogoReveal';
import { EndCard } from '../../remotion/components/EndCard';
import { SoftCut } from '../../remotion/components/SoftCut';
import { ColorWipe } from '../../remotion/components/ColorWipe';
import { ScalePush } from '../../remotion/components/ScalePush';
import { SplitHorizontal } from '../../remotion/components/SplitHorizontal';
import { SplitVertical } from '../../remotion/components/SplitVertical';
import { PictureInPicture } from '../../remotion/components/PictureInPicture';
import { TypographicBackground } from '../../remotion/components/TypographicBackground';
import { BrandProfile } from '../../src/types';

/** Minimal brand for tests — each test overrides what it cares about. */
function brand(overrides: Partial<BrandProfile> = {}): BrandProfile {
  return {
    id: 'bp',
    client_id: 'client-1',
    brand_colors: {
      primary: '#ff0000',
      secondary: '#000',
      accent: '#00ff00',
      background: '#111',
    },
    ...overrides,
  };
}

function wrap(node: React.ReactNode, overrides?: Partial<BrandProfile>): JSX.Element {
  return <BrandProvider brand={brand(overrides)}>{node}</BrandProvider>;
}

beforeEach(() => {
  (remotionMock.useCurrentFrame as jest.Mock).mockReturnValue(30);
  (remotionMock.useVideoConfig as jest.Mock).mockReturnValue({
    fps: 30,
    durationInFrames: 60,
    width: 1080,
    height: 1920,
    id: 'TabarioComposition',
    defaultProps: {},
  });
});

// ─── BrandProvider / useBrand ────────────────────────────────────────────────

describe('BrandProvider / useBrand', () => {
  function ColorProbe() {
    const b = useBrand();
    return (
      <div
        data-testid="probe"
        data-primary={b.colors.primary}
        data-accent={b.colors.accent}
        data-heading={b.headingFamily}
        data-body={b.bodyFamily}
        data-title-case={b.titleCase}
        data-logo-safe={String(b.logoSafeZoneRatio)}
      />
    );
  }

  it('merges defaults with partial brand_colors', () => {
    render(wrap(<ColorProbe />, { brand_colors: { primary: '#abcdef' } }));
    const el = screen.getByTestId('probe');
    expect(el.dataset.primary).toBe('#abcdef');
    // Accent untouched by override — comes from defaults
    expect(el.dataset.accent).toBe('#3B82F6');
  });

  it('uses fallback font stack when no URLs provided', () => {
    render(wrap(<ColorProbe />, { heading_font_url: undefined, body_font_url: undefined }));
    const el = screen.getByTestId('probe');
    expect(el.dataset.heading).not.toContain('TabarioBrandHeading');
    expect(el.dataset.body).not.toContain('TabarioBrandBody');
  });

  it('includes branded family name when URL present', () => {
    render(
      wrap(<ColorProbe />, {
        heading_font_url: 'https://cdn/h.woff2',
        body_font_url: 'https://cdn/b.woff2',
      }),
    );
    const el = screen.getByTestId('probe');
    expect(el.dataset.heading).toContain('TabarioBrandHeading');
    expect(el.dataset.body).toContain('TabarioBrandBody');
  });

  it('defaults titleCase to sentence and logoSafeZoneRatio to 0.15', () => {
    render(wrap(<ColorProbe />));
    const el = screen.getByTestId('probe');
    expect(el.dataset.titleCase).toBe('sentence');
    expect(el.dataset.logoSafe).toBe('0.15');
  });

  it('honours explicit title_case override', () => {
    render(wrap(<ColorProbe />, { title_case: 'upper' }));
    const el = screen.getByTestId('probe');
    expect(el.dataset.titleCase).toBe('upper');
  });
});

// ─── KineticTitle ────────────────────────────────────────────────────────────

describe('KineticTitle', () => {
  it('renders the text', () => {
    render(wrap(<KineticTitle text="hello world" />));
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('upper-cases when titleCase=upper', () => {
    render(wrap(<KineticTitle text="hello" />, { title_case: 'upper' }));
    expect(screen.getByText('HELLO')).toBeInTheDocument();
  });

  it('title-cases when titleCase=title', () => {
    render(wrap(<KineticTitle text="hello world" />, { title_case: 'title' }));
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('uses custom color when provided', () => {
    const { container } = render(wrap(<KineticTitle text="x" color="#123456" />));
    const el = container.querySelector('div > div');
    expect((el as HTMLElement).style.color).toBeDefined();
  });
});

// ─── StaggerTitle ────────────────────────────────────────────────────────────

describe('StaggerTitle', () => {
  it('renders each word as a separate span', () => {
    render(wrap(<StaggerTitle text="one two three" />));
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });
});

// ─── CaptionBar ──────────────────────────────────────────────────────────────

describe('CaptionBar', () => {
  it('renders the caption text', () => {
    render(wrap(<CaptionBar text="caption here" />));
    expect(screen.getByText('caption here')).toBeInTheDocument();
  });
});

// ─── LowerThird ──────────────────────────────────────────────────────────────

describe('LowerThird', () => {
  it('renders the name', () => {
    render(wrap(<LowerThird name="Alex" />));
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(wrap(<LowerThird name="Alex" subtitle="CTO" />));
    expect(screen.getByText('CTO')).toBeInTheDocument();
  });

  it('omits subtitle when not provided', () => {
    render(wrap(<LowerThird name="Alex" />));
    expect(screen.queryByText('CTO')).not.toBeInTheDocument();
  });
});

// ─── LogoReveal ──────────────────────────────────────────────────────────────

describe('LogoReveal', () => {
  it('returns null when no logo url configured', () => {
    const { container } = render(wrap(<LogoReveal />));
    expect(container.querySelector('[data-testid="img"]')).toBeNull();
  });

  it('renders an Img when logo_primary_url is configured', () => {
    const { container } = render(
      wrap(<LogoReveal />, { logo_primary_url: 'https://cdn/logo.png' }),
    );
    const img = container.querySelector('[data-testid="img"]');
    expect(img).not.toBeNull();
    expect((img as HTMLImageElement).src).toContain('logo.png');
  });
});

// ─── EndCard ─────────────────────────────────────────────────────────────────

describe('EndCard', () => {
  it('renders the CTA text', () => {
    render(wrap(<EndCard ctaText="Try Tabario" />));
    expect(screen.getByText('Try Tabario')).toBeInTheDocument();
  });

  it('renders the ctaUrl when provided', () => {
    render(wrap(<EndCard ctaText="Try" ctaUrl="https://tabario.com" />));
    expect(screen.getByText('https://tabario.com')).toBeInTheDocument();
  });

  it('shows the logo by default when configured', () => {
    const { container } = render(
      wrap(<EndCard ctaText="x" />, { logo_primary_url: 'https://cdn/logo.png' }),
    );
    expect(container.querySelector('[data-testid="img"]')).not.toBeNull();
  });

  it('hides the logo when showLogo=false', () => {
    const { container } = render(
      wrap(<EndCard ctaText="x" showLogo={false} />, {
        logo_primary_url: 'https://cdn/logo.png',
      }),
    );
    expect(container.querySelector('[data-testid="img"]')).toBeNull();
  });
});

// ─── SoftCut / ColorWipe / ScalePush ────────────────────────────────────────

describe('SoftCut', () => {
  it('renders both fromSrc and toSrc as Video elements', () => {
    const { container } = render(wrap(<SoftCut fromSrc="/a.mp4" toSrc="/b.mp4" />));
    const videos = container.querySelectorAll('[data-testid="video"]');
    expect(videos).toHaveLength(2);
    expect((videos[0] as HTMLVideoElement).src).toContain('/a.mp4');
    expect((videos[1] as HTMLVideoElement).src).toContain('/b.mp4');
  });
});

describe('ColorWipe', () => {
  it('renders both clips plus a coloured overlay', () => {
    const { container } = render(
      wrap(<ColorWipe fromSrc="/a.mp4" toSrc="/b.mp4" accentColor="#ff00ff" />),
    );
    const videos = container.querySelectorAll('[data-testid="video"]');
    expect(videos).toHaveLength(2);
  });

  it('falls back to brand accent when no accentColor provided', () => {
    const { container } = render(
      wrap(<ColorWipe fromSrc="/a" toSrc="/b" />, {
        brand_colors: { accent: '#123123' },
      }),
    );
    expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(2);
  });
});

describe('ScalePush', () => {
  it('renders both clips', () => {
    const { container } = render(wrap(<ScalePush fromSrc="/a" toSrc="/b" />));
    expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(2);
  });
});

// ─── Split layouts + PictureInPicture ────────────────────────────────────────

describe('SplitHorizontal', () => {
  it('renders left and right videos at the default 0.5 ratio', () => {
    const { container } = render(wrap(<SplitHorizontal leftSrc="/l" rightSrc="/r" />));
    expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(2);
  });

  it('honours a custom splitRatio', () => {
    const { container } = render(
      wrap(<SplitHorizontal leftSrc="/l" rightSrc="/r" splitRatio={0.25} />),
    );
    const leftWrap = container.firstChild?.firstChild as HTMLElement;
    expect(leftWrap.style.width).toBe('25%');
  });
});

describe('SplitVertical', () => {
  it('renders top and bottom videos', () => {
    const { container } = render(wrap(<SplitVertical topSrc="/t" bottomSrc="/b" />));
    expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(2);
  });
});

describe('PictureInPicture', () => {
  it('renders main + overlay videos', () => {
    const { container } = render(
      wrap(<PictureInPicture mainSrc="/m" overlaySrc="/o" />),
    );
    expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(2);
  });

  it.each(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const)(
    'places overlay at %s',
    (pos) => {
      const { container } = render(
        wrap(<PictureInPicture mainSrc="/m" overlaySrc="/o" position={pos} />),
      );
      expect(container.querySelectorAll('[data-testid="video"]')).toHaveLength(2);
    },
  );
});

// ─── TypographicBackground ──────────────────────────────────────────────────

describe('TypographicBackground', () => {
  it('renders the text', () => {
    render(wrap(<TypographicBackground text="impact" />));
    expect(screen.getByText('impact')).toBeInTheDocument();
  });

  it('upper-cases when titleCase=upper', () => {
    render(
      wrap(<TypographicBackground text="impact" />, { title_case: 'upper' }),
    );
    expect(screen.getByText('IMPACT')).toBeInTheDocument();
  });

  it('supports fade/slide/scale animations without throwing', () => {
    for (const anim of ['fade', 'slide', 'scale'] as const) {
      expect(() =>
        render(wrap(<TypographicBackground text="x" animation={anim} />)),
      ).not.toThrow();
    }
  });

  it('uses custom background color when provided', () => {
    const { container } = render(
      wrap(<TypographicBackground text="x" backgroundColor="#ff0" />),
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.backgroundColor).toBeTruthy();
  });
});
