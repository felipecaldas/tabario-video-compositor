import { StyleRegistry, DEFAULT_STYLE_ID } from '../../src/styles/registry';
import { EditStyleSchema } from '../../src/styles/schema';

const ALL_STYLE_IDS = [
  'tiktok_bold',
  'corporate_clean',
  'cinematic_storyteller',
  'neon_creator',
  'documentary',
  'educational_clean',
  'luxury_minimal',
  'energetic_youth',
];

describe('StyleRegistry', () => {
  describe('resolve', () => {
    it('resolves tiktok_bold and returns a valid EditStyle', () => {
      const style = StyleRegistry.resolve('tiktok_bold');
      expect(style.id).toBe('tiktok_bold');
      expect(EditStyleSchema.safeParse(style).success).toBe(true);
    });

    it('resolves corporate_clean (default)', () => {
      const style = StyleRegistry.resolve('corporate_clean');
      expect(style.id).toBe('corporate_clean');
    });

    it('throws a descriptive error for an unknown style id', () => {
      expect(() => StyleRegistry.resolve('unknown_style')).toThrow(
        "Unknown style id 'unknown_style'",
      );
    });

    it('returns the same object reference on repeated calls (cache)', () => {
      const a = StyleRegistry.resolve('documentary');
      const b = StyleRegistry.resolve('documentary');
      expect(a).toBe(b);
    });
  });

  describe('list', () => {
    it('returns all 8 built-in styles', () => {
      const styles = StyleRegistry.list();
      expect(styles).toHaveLength(8);
      const ids = styles.map((s) => s.id);
      ALL_STYLE_IDS.forEach((id) => expect(ids).toContain(id));
    });

    it('every style passes Zod schema validation', () => {
      StyleRegistry.list().forEach((style) => {
        const result = EditStyleSchema.safeParse(style);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('isValid', () => {
    it('returns true for known style ids', () => {
      ALL_STYLE_IDS.forEach((id) => expect(StyleRegistry.isValid(id)).toBe(true));
    });

    it('returns false for unknown ids', () => {
      expect(StyleRegistry.isValid('not_a_style')).toBe(false);
    });
  });

  describe('DEFAULT_STYLE_ID', () => {
    it('is corporate_clean', () => {
      expect(DEFAULT_STYLE_ID).toBe('corporate_clean');
    });

    it('resolves without error', () => {
      expect(() => StyleRegistry.resolve(DEFAULT_STYLE_ID)).not.toThrow();
    });
  });
});
