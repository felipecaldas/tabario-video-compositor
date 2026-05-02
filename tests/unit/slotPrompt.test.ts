import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('slotPrompt.md', () => {
  const promptPath = join(__dirname, '../../src/manifest/slotPrompt.md');

  it('exists on disk', () => {
    expect(existsSync(promptPath)).toBe(true);
  });

  it('is non-empty', () => {
    const content = readFileSync(promptPath, 'utf-8');
    expect(content.length).toBeGreaterThan(100);
  });

  it('describes the slot-filling task', () => {
    const content = readFileSync(promptPath, 'utf-8');
    expect(content).toContain('slot-filling');
    expect(content).toContain('template');
    expect(content).toContain('copy_role');
    expect(content).toContain('CompositionManifest');
  });

  it('includes rules for copy generation', () => {
    const content = readFileSync(promptPath, 'utf-8');
    expect(content).toContain('copy_role');
    expect(content).toContain('hook_headline');
    expect(content).toContain('product_name');
    expect(content).toContain('proof_metric');
    expect(content).toContain('cta_text');
  });

  it('includes rules for transition selection', () => {
    const content = readFileSync(promptPath, 'utf-8');
    expect(content).toContain('default_transitions');
    expect(content).toContain('soft_cut');
    expect(content).toContain('scale_push');
  });

  it('requires compose.v2 schema', () => {
    const content = readFileSync(promptPath, 'utf-8');
    expect(content).toContain('compose.v2');
  });

  it('includes style compliance rules', () => {
    const content = readFileSync(promptPath, 'utf-8');
    expect(content).toContain('style');
    expect(content).toContain('motion.energy');
    expect(content).toContain('typography');
    expect(content).toContain('overlays.density');
  });

  it('includes output validation checklist', () => {
    const content = readFileSync(promptPath, 'utf-8');
    expect(content).toContain('Final check');
    expect(content).toContain('required_overlay.copy_role');
    expect(content).toContain('pure JSON');
  });
});
