import { describe, it, expect } from 'vitest';
import {
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  SEVERITY_PRIORITY,
  SEVERITY_DESCRIPTIONS,
} from './severity';
import type { TicketSeverity } from '../types/ticket';

describe('Severity Constants', () => {
  const allSeverities: TicketSeverity[] = ['critical', 'high', 'medium', 'low'];

  describe('SEVERITY_LABELS', () => {
    it('should have labels for all severities', () => {
      allSeverities.forEach(severity => {
        expect(SEVERITY_LABELS[severity]).toBeDefined();
        expect(typeof SEVERITY_LABELS[severity]).toBe('string');
      });
    });

    it('should have capitalized labels', () => {
      expect(SEVERITY_LABELS.critical).toBe('Critical');
      expect(SEVERITY_LABELS.high).toBe('High');
      expect(SEVERITY_LABELS.medium).toBe('Medium');
      expect(SEVERITY_LABELS.low).toBe('Low');
    });
  });

  describe('SEVERITY_COLORS', () => {
    it('should have colors for all severities', () => {
      allSeverities.forEach(severity => {
        expect(SEVERITY_COLORS[severity]).toBeDefined();
        expect(SEVERITY_COLORS[severity]).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should have distinct colors', () => {
      const colors = Object.values(SEVERITY_COLORS);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('should use appropriate warning colors', () => {
      // Critical should be red-ish
      expect(SEVERITY_COLORS.critical.toLowerCase()).toMatch(/#[d-f][c-f]/);
      // Low should be green-ish
      expect(SEVERITY_COLORS.low.toLowerCase()).toContain('2');
    });
  });

  describe('SEVERITY_PRIORITY', () => {
    it('should have priorities for all severities', () => {
      allSeverities.forEach(severity => {
        expect(SEVERITY_PRIORITY[severity]).toBeDefined();
        expect(typeof SEVERITY_PRIORITY[severity]).toBe('number');
      });
    });

    it('should have correct priority ordering', () => {
      expect(SEVERITY_PRIORITY.critical).toBeGreaterThan(SEVERITY_PRIORITY.high);
      expect(SEVERITY_PRIORITY.high).toBeGreaterThan(SEVERITY_PRIORITY.medium);
      expect(SEVERITY_PRIORITY.medium).toBeGreaterThan(SEVERITY_PRIORITY.low);
    });

    it('should have unique priority values', () => {
      const priorities = Object.values(SEVERITY_PRIORITY);
      const uniquePriorities = new Set(priorities);
      expect(uniquePriorities.size).toBe(priorities.length);
    });

    it('should have positive priority values', () => {
      Object.values(SEVERITY_PRIORITY).forEach(priority => {
        expect(priority).toBeGreaterThan(0);
      });
    });
  });

  describe('SEVERITY_DESCRIPTIONS', () => {
    it('should have descriptions for all severities', () => {
      allSeverities.forEach(severity => {
        expect(SEVERITY_DESCRIPTIONS[severity]).toBeDefined();
        expect(typeof SEVERITY_DESCRIPTIONS[severity]).toBe('string');
        expect(SEVERITY_DESCRIPTIONS[severity].length).toBeGreaterThan(10);
      });
    });

    it('should have meaningful descriptions', () => {
      expect(SEVERITY_DESCRIPTIONS.critical.toLowerCase()).toContain('immediate');
      expect(SEVERITY_DESCRIPTIONS.high.toLowerCase()).toContain('major');
      expect(SEVERITY_DESCRIPTIONS.medium.toLowerCase()).toContain('workaround');
      expect(SEVERITY_DESCRIPTIONS.low.toLowerCase()).toContain('minor');
    });
  });

  describe('consistency', () => {
    it('should have same keys across all severity objects', () => {
      const labelsKeys = Object.keys(SEVERITY_LABELS).sort();
      const colorsKeys = Object.keys(SEVERITY_COLORS).sort();
      const priorityKeys = Object.keys(SEVERITY_PRIORITY).sort();
      const descriptionsKeys = Object.keys(SEVERITY_DESCRIPTIONS).sort();

      expect(labelsKeys).toEqual(colorsKeys);
      expect(labelsKeys).toEqual(priorityKeys);
      expect(labelsKeys).toEqual(descriptionsKeys);
    });
  });
});
