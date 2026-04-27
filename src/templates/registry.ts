import { UseCaseTemplate, UseCaseTemplateSchema } from './schema';

const TEMPLATE_IDS = [
  'ad',
  'how_to',
  'property_tour',
  'talking_head',
  'thought_leadership',
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

function loadTemplate(id: string): UseCaseTemplate {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const raw = require(`./library/${id}.json`);
  const result = UseCaseTemplateSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`UseCaseTemplate '${id}' failed validation: ${result.error.message}`);
  }
  return result.data;
}

const _cache = new Map<string, UseCaseTemplate>();

export const TemplateRegistry = {
  resolve(id: string): UseCaseTemplate {
    if (_cache.has(id)) return _cache.get(id)!;
    if (!(TEMPLATE_IDS as readonly string[]).includes(id)) {
      throw new Error(
        `Unknown template id '${id}'. Available templates: ${TEMPLATE_IDS.join(', ')}`,
      );
    }
    const template = loadTemplate(id);
    _cache.set(id, template);
    return template;
  },

  list(): UseCaseTemplate[] {
    return TEMPLATE_IDS.map((id) => TemplateRegistry.resolve(id));
  },

  isValid(id: string): id is TemplateId {
    return (TEMPLATE_IDS as readonly string[]).includes(id);
  },
};
