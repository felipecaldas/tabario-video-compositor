/**
 * @jest-environment jsdom
 *
 * Unit tests for remotion/fonts.ts — covers the pure helpers and the
 * delayRender/continueRender lifecycle for the useBrandFontLoader hook.
 */

jest.mock('remotion', () => require('../helpers/remotion-mock'));

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, act } from '@testing-library/react';
import * as remotionMock from '../helpers/remotion-mock';
import {
  BODY_FAMILY,
  HEADING_FAMILY,
  fontFamilyOrFallback,
  useBrandFontLoader,
} from '../../remotion/fonts';
import { BrandProvider, useBrand } from '../../remotion/BrandContext';

describe('fontFamilyOrFallback', () => {
  it('returns the fallback stack only when hasUrl is false', () => {
    const v = fontFamilyOrFallback(HEADING_FAMILY, false);
    expect(v).not.toContain('TabarioBrandHeading');
    expect(v).toContain('sans-serif');
  });

  it('prepends the branded family name when hasUrl is true', () => {
    const v = fontFamilyOrFallback(HEADING_FAMILY, true);
    expect(v.startsWith(`'${HEADING_FAMILY}'`)).toBe(true);
    expect(v).toContain('sans-serif');
  });

  it('exposes stable family constants', () => {
    expect(HEADING_FAMILY).toBe('TabarioBrandHeading');
    expect(BODY_FAMILY).toBe('TabarioBrandBody');
  });
});

describe('useBrandFontLoader', () => {
  beforeEach(() => {
    (remotionMock.delayRender as jest.Mock).mockClear();
    (remotionMock.continueRender as jest.Mock).mockClear();
  });

  function Harness(props: { heading?: string; body?: string }) {
    const state = useBrandFontLoader({
      headingFontUrl: props.heading,
      bodyFontUrl: props.body,
    });
    return (
      <div
        data-testid="state"
        data-heading-loaded={String(state.headingLoaded)}
        data-body-loaded={String(state.bodyLoaded)}
      />
    );
  }

  /** Ensure `document.fonts` exists so the hook does not short-circuit. */
  function ensureDocumentFonts(): { added: unknown[] } {
    const added: unknown[] = [];
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { add: (f: unknown) => added.push(f) },
    });
    return { added };
  }

  it('does not invoke delayRender when no URLs are provided', () => {
    ensureDocumentFonts();
    render(<Harness />);
    expect(remotionMock.delayRender).not.toHaveBeenCalled();
  });

  it('provides correct bodyFamily from context when brand has body_font_url', () => {
    const brand = {
      id: 'bp-1',
      client_id: 'c1',
      body_font_url: 'https://example.com/body.woff2',
    };
    let contextValue: any = null;
    function TestConsumer() {
      contextValue = useBrand();
      return <div />;
    }
    render(
      <BrandProvider brand={brand}>
        <TestConsumer />
      </BrandProvider>
    );
    expect(contextValue.bodyFamily).toBe(
      "'TabarioBrandBody', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    );
  });

  it('short-circuits when document.fonts API is absent', () => {
    // Remove fonts if present to simulate non-browser environments.
    if ('fonts' in document) {
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: undefined,
      });
      // jsdom's `in` operator returns true while the property exists —
      // delete it to fully emulate non-browser environments.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (document as any).fonts;
    }
    render(<Harness heading="https://cdn/h.woff2" />);
    expect(remotionMock.delayRender).not.toHaveBeenCalled();
  });

  it('issues delayRender + continueRender when FontFace constructor is missing', () => {
    ensureDocumentFonts();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).FontFace;
    render(<Harness heading="https://cdn/h.woff2" />);
    expect(remotionMock.delayRender).toHaveBeenCalledTimes(1);
    expect(remotionMock.continueRender).toHaveBeenCalledTimes(1);
  });

  it('delays render for both heading and body when both URLs set', () => {
    ensureDocumentFonts();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).FontFace;
    render(<Harness heading="https://cdn/h.woff2" body="https://cdn/b.woff2" />);
    expect(remotionMock.delayRender).toHaveBeenCalledTimes(2);
  });

  it('invokes the FontFace API and resolves when available', async () => {
    const { added } = ensureDocumentFonts();
    class FakeFontFace {
      constructor(public family: string, public src: string) {}
      async load() {
        return this;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).FontFace = FakeFontFace;

    await act(async () => {
      render(<Harness heading="https://cdn/h.woff2" />);
    });

    expect(added.length).toBeGreaterThan(0);
    expect(remotionMock.continueRender).toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).FontFace;
  });
});
