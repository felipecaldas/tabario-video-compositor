import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

export const HEADING_FAMILY = 'TabarioBrandHeading';
export const BODY_FAMILY = 'TabarioBrandBody';

const FALLBACK_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Compose a CSS `font-family` value that prefers the brand family name
 * (once loaded) and falls back to a reasonable sans-serif stack when the
 * brand URL is missing or the font has not finished loading.  Using the
 * family name rather than `url(...)` ensures the CSS is valid; the URL
 * has been registered via the `FontFace` API and `document.fonts.add`
 * in `useBrandFontLoader` below.
 */
export function fontFamilyOrFallback(family: string, hasUrl: boolean): string {
  return hasUrl ? `'${family}', ${FALLBACK_STACK}` : FALLBACK_STACK;
}

export interface BrandFontUrls {
  headingFontUrl?: string;
  bodyFontUrl?: string;
}

export interface BrandFontState {
  headingLoaded: boolean;
  bodyLoaded: boolean;
}

/**
 * Load brand fonts via the `FontFace` API and block the Remotion render
 * via `delayRender` / `continueRender` until both fonts have resolved
 * (or failed — we always continue so one bad URL cannot hang a render).
 */
export function useBrandFontLoader(urls: BrandFontUrls): BrandFontState {
  const { headingFontUrl, bodyFontUrl } = urls;
  const [state, setState] = useState<BrandFontState>({
    headingLoaded: false,
    bodyLoaded: false,
  });

  useEffect(() => {
    // Short-circuit when running outside the browser (e.g. SSR/unit tests)
    if (typeof document === 'undefined' || !('fonts' in document)) {
      return;
    }
    if (!headingFontUrl) {
      setState((s: BrandFontState) => ({ ...s, headingLoaded: true }));
      return;
    }
    const handle = delayRender(`load-heading-font: ${headingFontUrl}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FF = (typeof FontFace !== 'undefined' ? FontFace : null) as any;
    if (!FF) {
      continueRender(handle);
      return;
    }
    const font = new FF(HEADING_FAMILY, `url(${headingFontUrl})`);
    font
      .load()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((loaded: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).fonts.add(loaded);
        setState((s: BrandFontState) => ({ ...s, headingLoaded: true }));
        continueRender(handle);
      })
      .catch((err: Error) => {
        console.warn(`[fonts] Failed to load heading font ${headingFontUrl}: ${err.message}`);
        continueRender(handle);
      });
  }, [headingFontUrl]);

  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) {
      return;
    }
    if (!bodyFontUrl) {
      setState((s: BrandFontState) => ({ ...s, bodyLoaded: true }));
      return;
    }
    const handle = delayRender(`load-body-font: ${bodyFontUrl}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FF = (typeof FontFace !== 'undefined' ? FontFace : null) as any;
    if (!FF) {
      continueRender(handle);
      return;
    }
    const font = new FF(BODY_FAMILY, `url(${bodyFontUrl})`);
    font
      .load()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((loaded: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).fonts.add(loaded);
        setState((s: BrandFontState) => ({ ...s, bodyLoaded: true }));
        continueRender(handle);
      })
      .catch((err: Error) => {
        console.warn(`[fonts] Failed to load body font ${bodyFontUrl}: ${err.message}`);
        continueRender(handle);
      });
  }, [bodyFontUrl]);

  return state;
}
