import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../../src/lib/validation.js';
import type { Request, Response, NextFunction } from 'express';

describe('Validation middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('validateBody', () => {
    const bodySchema = z.object({
      name: z.string().min(1),
      badge: z.string().min(1).max(20),
      active: z.boolean().optional()
    });

    it('should pass valid request body to next middleware', async () => {
      mockRequest.body = {
        name: 'John Doe',
        badge: 'JD001',
        active: true
      };

      const middleware = validateBody(bodySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockRequest.body.name).toBe('John Doe');
    });

    it('should apply default values from schema', async () => {
      mockRequest.body = {
        name: 'John Doe',
        badge: 'JD001'
        // active not provided, should get default
      };

      const schemaWithDefault = z.object({
        name: z.string(),
        badge: z.string(),
        active: z.boolean().default(true)
      });

      const middleware = validateBody(schemaWithDefault);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.body.active).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      mockRequest.body = {
        name: 'John Doe'
        // missing badge
      };

      const middleware = validateBody(bodySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['badge'],
            message: expect.any(String)
          })
        ])
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid field types', async () => {
      mockRequest.body = {
        name: 123, // should be string
        badge: 'JD001',
        active: 'yes' // should be boolean
      };

      const middleware = validateBody(bodySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['name'],
            message: expect.stringContaining('string')
          })
        ])
      });
    });

    it('should return 400 for field length violations', async () => {
      mockRequest.body = {
        name: '', // too short
        badge: 'this-badge-is-way-too-long-for-the-schema', // too long
        active: true
      };

      const middleware = validateBody(bodySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['name']
          }),
          expect.objectContaining({
            path: ['badge']
          })
        ])
      });
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      period: z.string().regex(/^\d{4}-W\d{2}$/),
      limit: z.string().transform(Number).pipe(z.number().int().positive()).optional()
    });

    it('should pass valid query parameters', async () => {
      mockRequest.query = {
        period: '2024-W01',
        limit: '10'
      };

      const middleware = validateQuery(querySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.query.period).toBe('2024-W01');
      expect(mockRequest.query.limit).toBe(10); // Should be transformed to number
    });

    it('should handle optional parameters', async () => {
      mockRequest.query = {
        period: '2024-W01'
        // limit is optional
      };

      const middleware = validateQuery(querySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.query.period).toBe('2024-W01');
    });

    it('should return 400 for invalid period format', async () => {
      mockRequest.query = {
        period: '2024-1', // invalid format
      };

      const middleware = validateQuery(querySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['period'],
            message: expect.stringContaining('Invalid')
          })
        ])
      });
    });

    it('should return 400 for invalid numeric parameters', async () => {
      mockRequest.query = {
        period: '2024-W01',
        limit: 'not-a-number'
      };

      const middleware = validateQuery(querySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['limit']
          })
        ])
      });
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
      period: z.string().regex(/^\d{4}-W\d{2}$/).optional()
    });

    it('should pass valid UUID parameters', async () => {
      mockRequest.params = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      };

      const middleware = validateParams(paramsSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.params.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return 400 for invalid UUID format', async () => {
      mockRequest.params = {
        id: 'not-a-uuid'
      };

      const middleware = validateParams(paramsSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid URL parameters',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['id'],
            message: expect.stringContaining('uuid')
          })
        ])
      });
    });

    it('should handle multiple parameters', async () => {
      mockRequest.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        period: '2024-W01'
      };

      const middleware = validateParams(paramsSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.params.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(mockRequest.params.period).toBe('2024-W01');
    });
  });

  describe('Error handling', () => {
    it('should pass through non-Zod errors to next middleware', async () => {
      const throwingSchema = z.object({
        name: z.string().refine(() => {
          throw new Error('Custom error');
        })
      });

      mockRequest.body = { name: 'test' };

      const middleware = validateBody(throwingSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should provide detailed validation errors', async () => {
      const complexSchema = z.object({
        employee: z.object({
          name: z.string().min(1),
          badge: z.string().max(10)
        }),
        hours: z.number().positive()
      });

      mockRequest.body = {
        employee: {
          name: '',
          badge: 'this-is-too-long-badge'
        },
        hours: -5
      };

      const middleware = validateBody(complexSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['employee', 'name']
          }),
          expect.objectContaining({
            path: ['employee', 'badge']
          }),
          expect.objectContaining({
            path: ['hours']
          })
        ])
      });
    });
  });
});