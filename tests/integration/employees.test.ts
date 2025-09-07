import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import supertest from 'supertest';
import app from '../../src/server.js';
import { db, client } from '../../src/db/connection.js';
import { employees } from '../../src/db/schema.js';
import './setup.js';

const request = supertest(app);

describe('Employee CRUD Integration Tests', () => {
  beforeAll(async () => {
    // Ensure clean database state
    await db.delete(employees);
  });

  afterAll(async () => {
    // Clean up after tests
    await db.delete(employees);
    await client.end();
  });

  beforeEach(async () => {
    // Clean slate before each test
    await db.delete(employees);
  });

  describe('POST /api/employees', () => {
    it('should create employee with valid data', async () => {
      const newEmployee = {
        name: 'John Doe',
        badge: 'JD001',
        active: true
      };

      const response = await request
        .post('/api/employees')
        .send(newEmployee)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'John Doe',
        badge: 'JD001',
        active: true,
        created_at: expect.any(String)
      });

      // Verify in database
      const dbEmployees = await db.select().from(employees);
      expect(dbEmployees).toHaveLength(1);
      expect(dbEmployees[0].name).toBe('John Doe');
    });

    it('should create employee with minimal data (defaults)', async () => {
      const newEmployee = {
        name: 'Jane Smith',
        badge: 'JS002'
        // active should default to true
      };

      const response = await request
        .post('/api/employees')
        .send(newEmployee)
        .expect(201);

      expect(response.body.active).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidEmployee = {
        name: 'John Doe'
        // missing badge
      };

      const response = await request
        .post('/api/employees')
        .send(invalidEmployee)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: expect.arrayContaining([
          expect.objectContaining({
            path: ['badge']
          })
        ])
      });
    });

    it('should return 400 for invalid field lengths', async () => {
      const invalidEmployee = {
        name: '', // too short
        badge: 'this-badge-is-way-too-long-for-schema' // too long
      };

      const response = await request
        .post('/api/employees')
        .send(invalidEmployee)
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['name'] }),
          expect.objectContaining({ path: ['badge'] })
        ])
      );
    });

    it('should return 409 for duplicate badge', async () => {
      // Create first employee
      const employee1 = {
        name: 'John Doe',
        badge: 'DUPLICATE'
      };

      await request
        .post('/api/employees')
        .send(employee1)
        .expect(201);

      // Try to create second employee with same badge
      const employee2 = {
        name: 'Jane Smith',
        badge: 'DUPLICATE' // Same badge
      };

      const response = await request
        .post('/api/employees')
        .send(employee2)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'Conflict',
        message: expect.stringContaining('badge')
      });

      // Verify only one employee exists
      const dbEmployees = await db.select().from(employees);
      expect(dbEmployees).toHaveLength(1);
    });

    it('should handle database constraint violations gracefully', async () => {
      const invalidEmployee = {
        name: 'A'.repeat(101), // Exceeds database constraint
        badge: 'TEST'
      };

      const response = await request
        .post('/api/employees')
        .send(invalidEmployee)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/employees', () => {
    it('should list all employees', async () => {
      // Create test employees
      const testEmployees = [
        { name: 'Alice Smith', badge: 'AS001', active: true },
        { name: 'Bob Johnson', badge: 'BJ002', active: true },
        { name: 'Charlie Brown', badge: 'CB003', active: false }
      ];

      for (const emp of testEmployees) {
        await request.post('/api/employees').send(emp);
      }

      const response = await request
        .get('/api/employees')
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Alice Smith', badge: 'AS001' }),
          expect.objectContaining({ name: 'Bob Johnson', badge: 'BJ002' }),
          expect.objectContaining({ name: 'Charlie Brown', badge: 'CB003' })
        ])
      );
    });

    it('should return empty array when no employees exist', async () => {
      const response = await request
        .get('/api/employees')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should include all employee fields', async () => {
      const employee = {
        name: 'Test Employee',
        badge: 'TE001',
        active: false
      };

      await request.post('/api/employees').send(employee);

      const response = await request
        .get('/api/employees')
        .expect(200);

      expect(response.body[0]).toMatchObject({
        id: expect.any(String),
        name: 'Test Employee',
        badge: 'TE001',
        active: false,
        created_at: expect.any(String)
      });
    });
  });

  describe('PATCH /api/employees/:id', () => {
    let createdEmployee: any;

    beforeEach(async () => {
      const response = await request
        .post('/api/employees')
        .send({
          name: 'Update Test Employee',
          badge: 'UTE001',
          active: true
        });
      createdEmployee = response.body;
    });

    it('should update existing employee', async () => {
      const updates = {
        name: 'Updated Name',
        active: false
      };

      const response = await request
        .patch(`/api/employees/${createdEmployee.id}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdEmployee.id,
        name: 'Updated Name',
        badge: 'UTE001', // Should remain unchanged
        active: false,
        created_at: createdEmployee.created_at
      });

      // Verify in database
      const dbEmployees = await db.select().from(employees);
      expect(dbEmployees[0].name).toBe('Updated Name');
      expect(dbEmployees[0].active).toBe(false);
    });

    it('should update badge without conflicts', async () => {
      const updates = {
        badge: 'NEW_BADGE'
      };

      const response = await request
        .patch(`/api/employees/${createdEmployee.id}`)
        .send(updates)
        .expect(200);

      expect(response.body.badge).toBe('NEW_BADGE');
    });

    it('should return 404 for non-existent employee', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';
      const updates = {
        name: 'Should Not Work'
      };

      const response = await request
        .patch(`/api/employees/${nonExistentId}`)
        .send(updates)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: expect.stringContaining('Employee')
      });
    });

    it('should return 400 for invalid UUID format', async () => {
      const updates = {
        name: 'Test'
      };

      const response = await request
        .patch('/api/employees/invalid-uuid')
        .send(updates)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
        message: 'Invalid URL parameters'
      });
    });

    it('should return 409 for duplicate badge conflict', async () => {
      // Create another employee
      const otherEmployee = await request
        .post('/api/employees')
        .send({
          name: 'Other Employee',
          badge: 'OTHER001'
        });

      // Try to update first employee to use second employee's badge
      const updates = {
        badge: 'OTHER001'
      };

      const response = await request
        .patch(`/api/employees/${createdEmployee.id}`)
        .send(updates)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'Conflict',
        message: expect.stringContaining('badge')
      });
    });

    it('should validate field constraints on updates', async () => {
      const updates = {
        name: '', // too short
        badge: 'this-badge-is-way-too-long-for-database-constraints'
      };

      const response = await request
        .patch(`/api/employees/${createdEmployee.id}`)
        .send(updates)
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['name'] }),
          expect.objectContaining({ path: ['badge'] })
        ])
      );
    });

    it('should allow partial updates', async () => {
      const updates = {
        active: false
        // name and badge should remain unchanged
      };

      const response = await request
        .patch(`/api/employees/${createdEmployee.id}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdEmployee.id,
        name: createdEmployee.name, // unchanged
        badge: createdEmployee.badge, // unchanged
        active: false // changed
      });
    });
  });

  describe('Database constraints', () => {
    it('should enforce unique badge constraint', async () => {
      const employee1 = { name: 'First', badge: 'UNIQUE' };
      const employee2 = { name: 'Second', badge: 'UNIQUE' };

      await request.post('/api/employees').send(employee1).expect(201);
      await request.post('/api/employees').send(employee2).expect(409);
    });

    it('should enforce name length constraints', async () => {
      const longName = 'A'.repeat(101);
      const employee = { name: longName, badge: 'TEST' };

      await request
        .post('/api/employees')
        .send(employee)
        .expect(400);
    });

    it('should enforce badge length constraints', async () => {
      const longBadge = 'B'.repeat(21);
      const employee = { name: 'Test', badge: longBadge };

      await request
        .post('/api/employees')
        .send(employee)
        .expect(400);
    });
  });
});