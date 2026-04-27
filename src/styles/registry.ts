import { EditStyle, EditStyleSchema } from './schema';

// Built-in style IDs
const STYLE_IDS = [
  'tiktok_bold',
  'corporate_clean',
  'cinematic_storyteller',
  'neon_creator',
  'documentary',
  'educational_clean',
  'luxury_minimal',
  'energetic_youth',
] as const;

export type StyleId = (typeof STYLE_IDS)[number];

function loadStyle(id: string): EditStyle {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const raw = require(`./library/${id}.json`);
  const result = EditStyleSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`EditStyle '${id}' failed validation: ${result.error.message}`);
  }
  return result.data;
}

const _cache = new Map<string, EditStyle>();

export const StyleRegistry = {
  resolve(id: string): EditStyle {
    if (_cache.has(id)) return _cache.get(id)!;
    if (!(STYLE_IDS as readonly string[]).includes(id)) {
      throw new Error(
        `Unknown style id '${id}'. Available styles: ${STYLE_IDS.join(', ')}`,
      );
    }
    const style = loadStyle(id);
    _cache.set(id, style);
    return style;
  },

  list(): EditStyle[] {
    return STYLE_IDS.map((id) => StyleRegistry.resolve(id));
  },

  isValid(id: string): id is StyleId {
    return (STYLE_IDS as readonly string[]).includes(id);
  },
};

export const DEFAULT_STYLE_ID: StyleId = 'corporate_clean';
