import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import supertest from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../../src/server.js';
import { db, client } from '../../src/db/connection.js';
import { employees, overtimeEntries, assignments } from '../../src/db/schema.js';
import './setup.js';

const request = supertest(app);

describe('Assignment Concurrency Tests', () => {
  let testEmployees: any[] = [];

  beforeAll(async () => {
    // Clean all tables
    await db.delete(assignments);
    await db.delete(overtimeEntries);
    await db.delete(employees);
  });

  afterAll(async () => {
    await db.delete(assignments);
    await db.delete(overtimeEntries);
    await db.delete(employees);
    await client.end();
  });

  beforeEach(async () => {
    // Clean data before each test
    await db.delete(assignments);
    await db.delete(overtimeEntries);
    await db.delete(employees);

    // Create test employees
    const employeeData = [
      { name: 'Alice Smith', badge: 'AS001' },
      { name: 'Bob Johnson', badge: 'BJ002' },
      { name: 'Charlie Brown', badge: 'CB003' }
    ];

    testEmployees = [];
    for (const emp of employeeData) {
      const response = await request.post('/api/employees').send(emp);
      testEmployees.push(response.body);
    }

    // Sort by UUID for predictable ordering
    testEmployees.sort((a, b) => a.id.localeCompare(b.id));

    // Give all employees same starting hours
    for (const emp of testEmployees) {
      await request.post('/api/overtime-entries').send({
        employee_id: emp.id,
        hours: 4,
        occurred_at: '2024-01-01T08:00:00Z'
      });
    }
  });

  describe('Concurrent assignment prevention', () => {
    it('should prevent double assignment with unique constraint violation', async () => {
      const period = '2024-W01';
      const assignmentPayload = {
        period,
        hours: 8,
        reason: 'concurrent test'
      };

      // Fire two simultaneous assignment requests
      const [response1, response2] = await Promise.allSettled([
        request.post('/api/assign-next').send(assignmentPayload),
        request.post('/api/assign-next').send(assignmentPayload)
      ]);

      // One should succeed, one should fail
      const responses = [response1, response2];
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const failed = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 409 ||
        r.status === 'rejected'
      );

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Check that only one assignment was created
      const dbAssignments = await db.select().from(assignments).where(eq(assignments.period_week, period));
      expect(dbAssignments).toHaveLength(1);

      // The failed request should return 409 Conflict
      if (response2.status === 'fulfilled') {
        expect([201, 409]).toContain(response2.value.status);
        if (response2.value.status === 409) {
          expect(response2.value.body).toMatchObject({
            error: 'Conflict',
            message: expect.stringContaining('already assigned')
          });
        }
      }
    });

    it('should handle rapid sequential assignments to different employees', async () => {
      const period = '2024-W01';
      
      // Make multiple rapid assignments
      const assignmentPromises = [];
      for (let i = 0; i < 3; i++) {
        assignmentPromises.push(
          request.post('/api/assign-next').send({
            period,
            hours: 8,
            reason: `assignment ${i + 1}`
          })
        );
      }

      const responses = await Promise.allSettled(assignmentPromises);
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);

      // All should succeed since they assign to different employees
      expect(successful).toHaveLength(3);

      // Verify all 3 employees got assigned
      const dbAssignments = await db.select().from(assignments).where(eq(assignments.period_week, period));
      expect(dbAssignments).toHaveLength(3);

      // Each employee should be assigned exactly once
      const employeeIds = dbAssignments.map(a => a.employee_id);
      const uniqueEmployeeIds = [...new Set(employeeIds)];
      expect(uniqueEmployeeIds).toHaveLength(3);
    });

    it('should handle concurrent assignments in different periods', async () => {
      const periods = ['2024-W01', '2024-W02', '2024-W03'];
      
      // Fire concurrent assignments for different periods
      const assignmentPromises = periods.map(period => 
        request.post('/api/assign-next').send({
          period,
          hours: 8,
          reason: `period ${period}`
        })
      );

      const responses = await Promise.allSettled(assignmentPromises);
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);

      // All should succeed since they're different periods
      expect(successful).toHaveLength(3);

      // Verify assignments in each period
      for (const period of periods) {
        const periodAssignments = await db.select()
          .from(assignments)
          .where(eq(assignments.period_week, period));
        expect(periodAssignments).toHaveLength(1);
      }
    });

    it('should maintain data consistency under concurrent load', async () => {
      const period = '2024-W01';
      const numConcurrentRequests = 10;
      
      // Fire many concurrent assignment requests for same period
      const assignmentPromises = Array.from({ length: numConcurrentRequests }, (_, i) =>
        request.post('/api/assign-next').send({
          period,
          hours: 8,
          reason: `load test ${i + 1}`
        })
      );

      const responses = await Promise.allSettled(assignmentPromises);
      
      // Count successful and failed responses
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const conflicts = responses.filter(r => r.status === 'fulfilled' && r.value.status === 409);
      const notFound = responses.filter(r => r.status === 'fulfilled' && r.value.status === 404);

      // Should have exactly 3 successful assignments (one per employee)
      // The rest should be conflicts or not found (when no more eligible employees)
      expect(successful.length + conflicts.length + notFound.length).toBe(numConcurrentRequests);
      expect(successful).toHaveLength(3); // One per employee

      // Verify database consistency
      const dbAssignments = await db.select().from(assignments).where(eq(assignments.period_week, period));
      expect(dbAssignments).toHaveLength(3);

      // Each employee should be assigned exactly once
      const assignedEmployees = new Set(dbAssignments.map(a => a.employee_id));
      expect(assignedEmployees.size).toBe(3);
    });

    it('should handle concurrent WHO-IS-NEXT queries during assignments', async () => {
      const period = '2024-W01';
      
      // Mix of who-is-next queries and assignments
      const operations = [
        request.get(`/api/who-is-next?period=${period}`),
        request.post('/api/assign-next').send({ period, hours: 8, reason: 'concurrent op 1' }),
        request.get(`/api/who-is-next?period=${period}`),
        request.post('/api/assign-next').send({ period, hours: 8, reason: 'concurrent op 2' }),
        request.get(`/api/who-is-next?period=${period}`),
      ];

      const responses = await Promise.allSettled(operations);
      
      // All WHO-IS-NEXT queries should succeed
      const whoIsNextResponses = responses.filter((_, i) => i % 2 === 0); // Even indices
      whoIsNextResponses.forEach(response => {
        if (response.status === 'fulfilled') {
          expect(response.value.status).toBe(200);
          expect(response.value.body.candidates).toBeInstanceOf(Array);
        }
      });

      // Assignment responses should be either success or conflict
      const assignmentResponses = responses.filter((_, i) => i % 2 === 1); // Odd indices  
      assignmentResponses.forEach(response => {
        if (response.status === 'fulfilled') {
          expect([201, 409]).toContain(response.value.status);
        }
      });
    });

    it('should handle database connection limits gracefully', async () => {
      const period = '2024-W01';
      const highConcurrency = 20;
      
      // Create high concurrency load to test connection pooling
      const operations = Array.from({ length: highConcurrency }, (_, i) => {
        if (i % 3 === 0) {
          return request.get(`/api/who-is-next?period=${period}`);
        } else if (i % 3 === 1) {
          return request.get(`/api/overtime-summary?period=${period}`);
        } else {
          return request.post('/api/assign-next').send({
            period,
            hours: 8,
            reason: `high concurrency ${i}`
          });
        }
      });

      const responses = await Promise.allSettled(operations);
      
      // Most requests should complete successfully (not timeout or fail due to connection issues)
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && [200, 201, 404, 409].includes(r.value.status)
      );
      const errors = responses.filter(r => r.status === 'rejected');

      // Should have minimal errors (allow some due to high load)
      expect(errors.length).toBeLessThan(highConcurrency * 0.1); // Less than 10% errors
      expect(successful.length).toBeGreaterThan(highConcurrency * 0.8); // More than 80% success
    });

    it('should prevent assignment race conditions with database transactions', async () => {
      const period = '2024-W01';
      
      // Set up scenario where employee selection could change during assignment
      // Employee with slightly different hours to make selection non-obvious
      await request.post('/api/overtime-entries').send({
        employee_id: testEmployees[0].id,
        hours: 0.5, // Slightly less than others
        occurred_at: '2024-01-02T08:00:00Z'
      });

      // Fire concurrent assignments when one employee has slight advantage
      const assignmentPromises = Array.from({ length: 5 }, (_, i) =>
        request.post('/api/assign-next').send({
          period,
          hours: 8,
          reason: `race condition test ${i}`
        })
      );

      const responses = await Promise.allSettled(assignmentPromises);
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);

      // First assignment should go to employee with lowest hours
      if (successful.length > 0) {
        expect(successful[0].value.body.employee_id).toBe(testEmployees[0].id);
      }

      // Verify database state is consistent
      const dbAssignments = await db.select().from(assignments).where(eq(assignments.period_week, period));
      expect(dbAssignments.length).toBeLessThanOrEqual(testEmployees.length);
      
      // No duplicate assignments per employee
      const assignedEmployees = dbAssignments.map(a => a.employee_id);
      const uniqueAssignedEmployees = [...new Set(assignedEmployees)];
      expect(assignedEmployees.length).toBe(uniqueAssignedEmployees.length);
    });
  });
});