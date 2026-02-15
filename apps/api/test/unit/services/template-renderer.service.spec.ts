import { Test, TestingModule } from '@nestjs/testing';
import {
  TemplateRendererService,
  DEFAULT_TEMPLATE,
  TEMPLATE_PLACEHOLDERS,
} from '../../../src/modules/github/services/template-renderer.service';

describe('TemplateRendererService', () => {
  let service: TemplateRendererService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TemplateRendererService],
    }).compile();

    service = module.get<TemplateRendererService>(TemplateRendererService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('render', () => {
    it('should replace all placeholders with values', () => {
      const template = '{{title}} - {{severity}}';
      const data = { title: 'Bug report', severity: 'high' };
      expect(service.render(template, data)).toBe('Bug report - high');
    });

    it('should replace multiple occurrences of the same placeholder', () => {
      const template = '{{title}} and also {{title}}';
      const data = { title: 'Hello' };
      expect(service.render(template, data)).toBe('Hello and also Hello');
    });

    it('should leave unknown placeholders untouched', () => {
      const template = '{{title}} {{unknown_placeholder}}';
      const data = { title: 'Test' };
      expect(service.render(template, data)).toBe('Test {{unknown_placeholder}}');
    });

    it('should replace placeholder with empty string when value is empty', () => {
      const template = 'Title: {{title}}';
      const data = { title: '' };
      expect(service.render(template, data)).toBe('Title: ');
    });

    it('should handle template with no placeholders', () => {
      const template = 'Plain text with no placeholders.';
      const data = { title: 'Test' };
      expect(service.render(template, data)).toBe('Plain text with no placeholders.');
    });

    it('should handle empty data object', () => {
      const template = '{{title}} - {{severity}}';
      expect(service.render(template, {})).toBe('{{title}} - {{severity}}');
    });

    it('should handle keys passed with curly braces', () => {
      const template = '{{title}} - {{severity}}';
      const data = { '{{title}}': 'Test', severity: 'low' };
      expect(service.render(template, data)).toBe('Test - low');
    });

    it('should render the default template with sample data', () => {
      const sampleData = service.getSampleData();
      const rendered = service.render(DEFAULT_TEMPLATE, sampleData);

      expect(rendered).toContain(sampleData.description);
      expect(rendered).toContain('high');
      expect(rendered).toContain('bug');
      expect(rendered).toContain('abc12345');
      expect(rendered).not.toContain('{{description}}');
      expect(rendered).not.toContain('{{severity}}');
    });
  });

  describe('validate', () => {
    it('should return valid true for a non-empty template', () => {
      const result = service.validate('## {{title}}');
      expect(result.valid).toBe(true);
    });

    it('should return valid false for an empty template', () => {
      const result = service.validate('   ');
      expect(result.valid).toBe(false);
    });

    it('should list present and missing placeholders', () => {
      const template = '{{title}} {{severity}}';
      const result = service.validate(template);

      expect(result.placeholders).toContain('{{title}}');
      expect(result.placeholders).toContain('{{severity}}');
      expect(result.missingPlaceholders).toContain('{{description}}');
      expect(result.missingPlaceholders).toContain('{{type}}');
    });

    it('should recognize all known placeholders in the default template', () => {
      const result = service.validate(DEFAULT_TEMPLATE);
      expect(result.valid).toBe(true);
      // The default template should include most placeholders
      expect(result.placeholders.length).toBeGreaterThan(5);
    });
  });

  describe('getDefaultTemplate', () => {
    it('should return the default template constant', () => {
      expect(service.getDefaultTemplate()).toBe(DEFAULT_TEMPLATE);
    });

    it('should contain key structural elements', () => {
      const template = service.getDefaultTemplate();
      expect(template).toContain('## Description');
      expect(template).toContain('{{description}}');
      expect(template).toContain('{{severity}}');
      expect(template).toContain('{{type}}');
    });
  });

  describe('getPlaceholders', () => {
    it('should return a copy of TEMPLATE_PLACEHOLDERS', () => {
      const placeholders = service.getPlaceholders();
      expect(placeholders).toEqual(TEMPLATE_PLACEHOLDERS);
      // Ensure it's a copy, not a reference
      placeholders['{{new}}'] = 'test';
      expect(TEMPLATE_PLACEHOLDERS['{{new}}']).toBeUndefined();
    });
  });

  describe('getSampleData', () => {
    it('should return sample data for all known placeholder keys', () => {
      const sampleData = service.getSampleData();
      const knownKeys = Object.keys(TEMPLATE_PLACEHOLDERS).map((k) =>
        k.replace(/^\{\{|\}\}$/g, ''),
      );

      for (const key of knownKeys) {
        expect(sampleData).toHaveProperty(key);
        expect(typeof sampleData[key]).toBe('string');
        expect(sampleData[key].length).toBeGreaterThan(0);
      }
    });
  });
});
