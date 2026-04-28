import { TemplateRegistry } from '../../src/templates/registry';
import { UseCaseTemplateSchema } from '../../src/templates/schema';

const ALL_TEMPLATE_IDS = [
  'ad',
  'how_to',
  'property_tour',
  'talking_head',
  'thought_leadership',
];

describe('TemplateRegistry', () => {
  describe('resolve', () => {
    it('resolves ad template and returns a valid UseCaseTemplate', () => {
      const template = TemplateRegistry.resolve('ad');
      expect(template.id).toBe('ad');
      expect(UseCaseTemplateSchema.safeParse(template).success).toBe(true);
    });

    it('resolves talking_head template', () => {
      const template = TemplateRegistry.resolve('talking_head');
      expect(template.id).toBe('talking_head');
      expect(template.scene_blueprint.length).toBeGreaterThan(0);
    });

    it('throws a descriptive error for an unknown template id', () => {
      expect(() => TemplateRegistry.resolve('unknown_template')).toThrow(
        "Unknown template id 'unknown_template'",
      );
    });

    it('returns the same object reference on repeated calls (cache)', () => {
      const a = TemplateRegistry.resolve('how_to');
      const b = TemplateRegistry.resolve('how_to');
      expect(a).toBe(b);
    });
  });

  describe('list', () => {
    it('returns all 5 built-in templates', () => {
      const templates = TemplateRegistry.list();
      expect(templates).toHaveLength(5);
      const ids = templates.map((t) => t.id);
      ALL_TEMPLATE_IDS.forEach((id) => expect(ids).toContain(id));
    });

    it('every template passes Zod schema validation', () => {
      TemplateRegistry.list().forEach((template) => {
        const result = UseCaseTemplateSchema.safeParse(template);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('isValid', () => {
    it('returns true for known template ids', () => {
      ALL_TEMPLATE_IDS.forEach((id) => expect(TemplateRegistry.isValid(id)).toBe(true));
    });

    it('returns false for unknown ids', () => {
      expect(TemplateRegistry.isValid('not_a_template')).toBe(false);
    });
  });

  describe('ad scene blueprint', () => {
    it('has expected roles in order', () => {
      const template = TemplateRegistry.resolve('ad');
      const roles = template.scene_blueprint.map((s) => s.role);
      expect(roles).toEqual(['hook', 'problem', 'solution', 'proof', 'outcome', 'cta']);
    });

    it('proof slot has one_to_many cardinality', () => {
      const template = TemplateRegistry.resolve('ad');
      const proof = template.scene_blueprint.find((s) => s.role === 'proof');
      expect(proof?.cardinality).toBe('one_to_many');
    });
  });

  describe('how_to scene blueprint', () => {
    it('step slot has one_to_many cardinality', () => {
      const template = TemplateRegistry.resolve('how_to');
      const step = template.scene_blueprint.find((s) => s.role === 'step');
      expect(step?.cardinality).toBe('one_to_many');
    });
  });
});
