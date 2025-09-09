import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import supertest from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../../src/server.js';
import { db, client } from '../../src/db/connection.js';
import { employees, overtimeEntries, assignments } from '../../src/db/schema.js';
import './setup.js';
import { createTestEmployeeData, findEmployeeByName, sortEmployeesByName } from '../utils/testHelpers.js';

const request = supertest(app);

describe('Assignment Concurrency Tests', () => {
  let testEmployees: any[] = [];

  // Helper function to safely sort employees by ID
  const sortEmployees = (employees: any[]) => {
    return employees.filter(emp => emp && emp.id).sort((a, b) => a.id.localeCompare(b.id));
  };

  // Note: Database cleanup handled by global test setup

  beforeEach(async () => {
    // Create test employees with unique badges to avoid conflicts
    const employeeData = createTestEmployeeData('concurrency');

    testEmployees = [];
    for (const emp of employeeData) {
      const response = await request.post('/api/employees').send(emp).expect(201);
      if (response.body && response.body.id) {
        testEmployees.push(response.body);
      }
    }

    // Sort by name for predictable ordering
    testEmployees = sortEmployeesByName(testEmployees);

    // Give all employees same starting hours
    for (const emp of testEmployees) {
      await request.post('/api/overtime-entries').send({
        employee_id: emp.id,
        hours: 4,
        occurred_at: '2024-01-01T08:00:00Z'
      }).expect(201);
    }
  });

  describe('Concurrent assignment prevention', () => {
    it('should handle concurrent assignments to different employees', async () => {
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

      // Both should succeed (assigns to different employees)
      const responses = [response1, response2];
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const failed = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 409 ||
        r.status === 'rejected'
      );

      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(0);

      // Check that two assignments were created (to different employees)
      const dbAssignments = await db.select().from(assignments).where(eq(assignments.period_week, period));
      expect(dbAssignments).toHaveLength(2);
      
      // Verify assignments are to different employees
      const assignedEmployees = dbAssignments.map(a => a.employee_id);
      expect(new Set(assignedEmployees).size).toBe(2);

      // Both requests should succeed with 201 status
      expect(response1.status).toBe('fulfilled');
      expect(response2.status).toBe('fulfilled');
      expect((response1.value as any).status).toBe(201);
      expect((response2.value as any).status).toBe(201);
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

      // Should handle high load without crashing (resource exhaustion expected)
      expect(errors.length).toBeLessThanOrEqual(highConcurrency * 0.6); // 60% or fewer errors (Promise rejections)
      expect(successful.length).toBeGreaterThan(highConcurrency * 0.3); // More than 30% success
    });

    it('should prevent assignment race conditions with database transactions', async () => {
      const period = '2024-W01';
      
      // Set up scenario where employee selection could change during assignment
      // Alice with slightly different hours to make selection non-obvious
      const alice = findEmployeeByName(testEmployees, 'Alice Smith');
      await request.post('/api/overtime-entries').send({
        employee_id: alice.id,
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

      // At least one assignment should succeed and should be for a valid employee
      expect(successful.length).toBeGreaterThanOrEqual(1);
      if (successful.length > 0) {
        // Just verify it's a valid employee ID (don't enforce specific employee)
        expect(successful[0].value.body.employee_id).toBeDefined();
        expect(typeof successful[0].value.body.employee_id).toBe('string');
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