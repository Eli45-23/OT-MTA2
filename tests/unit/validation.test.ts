import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../../src/lib/validation.js';

describe('Validation middleware', () => {
  describe('validateBody', () => {
    it('should validate request body with schema', () => {
      const schema = z.object({ name: z.string() });
      const middleware = validateBody(schema);
      expect(middleware).toBeInstanceOf(Function);
    });
  });

  describe('validateQuery', () => {
    it('should validate query parameters with schema', () => {
      const schema = z.object({ period: z.string() });
      const middleware = validateQuery(schema);
      expect(middleware).toBeInstanceOf(Function);
    });
  });

  describe('validateParams', () => {
    it('should validate URL parameters with schema', () => {
      const schema = z.object({ id: z.string().uuid() });
      const middleware = validateParams(schema);
      expect(middleware).toBeInstanceOf(Function);
    });
  });
});