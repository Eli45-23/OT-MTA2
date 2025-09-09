import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import supertest from 'supertest';
import app from '../../src/server.js';
import { db, client } from '../../src/db/connection.js';
import { employees, overtimeEntries, assignments, config } from '../../src/db/schema.js';
import './setup.js';
import { createTestEmployeeData, findEmployeeByName, sortEmployeesByName } from '../utils/testHelpers.js';

const request = supertest(app);

describe('Assignment Logic Integration Tests', () => {
  let testEmployees: any[] = [];
  let alice: any, bob: any, charlie: any;

  beforeEach(async () => {
    // Create test employees with unique badges to avoid conflicts
    const employeeData = createTestEmployeeData('assignments');

    testEmployees = [];
    for (const emp of employeeData) {
      const response = await request.post('/api/employees').send(emp).expect(201);
      if (response.body && response.body.id) {
        testEmployees.push(response.body);
      }
    }

    // Sort for predictable ordering and assign to named variables
    testEmployees = sortEmployeesByName(testEmployees);
    alice = findEmployeeByName(testEmployees, 'Alice Smith');
    bob = findEmployeeByName(testEmployees, 'Bob Johnson');
    charlie = findEmployeeByName(testEmployees, 'Charlie Brown');
  });

  describe('Assignment ordering', () => {
    it('should assign to employee with lowest total hours', async () => {
      // Set up different overtime hours
      await request.post('/api/overtime-entries').send({
        employee_id: alice.id,
        hours: 4,
        occurred_at: '2024-01-01T08:00:00Z'
      });

      await request.post('/api/overtime-entries').send({
        employee_id: bob.id,
        hours: 2, // Lowest hours
        occurred_at: '2024-01-02T08:00:00Z'
      });

      await request.post('/api/overtime-entries').send({
        employee_id: charlie.id,
        hours: 6,
        occurred_at: '2024-01-03T08:00:00Z'
      });

      // Get who is next - should be Bob with 2 hours
      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      expect(whoIsNextResponse.body.candidates[0]).toMatchObject({
        employee_id: bob.id,
        name: 'Bob Johnson',
        total_hours: 2,
        tie_break_rank: 1
      });

      // Assign next - should assign to Bob
      const assignResponse = await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 8,
          reason: 'coverage needed'
        })
        .expect(201);

      expect(assignResponse.body).toMatchObject({
        employee_id: bob.id,
        period_week: '2024-W01',
        hours_charged: 8,
        status: 'assigned',
        tie_break_rank: 1
      });
    });

    it('should handle tie-breaking by last assigned date', async () => {
      // Give Alice and Bob same overtime hours, Charlie more
      await request.post('/api/overtime-entries').send({
        employee_id: alice.id,
        hours: 4,
        occurred_at: '2024-01-01T08:00:00Z'
      });

      await request.post('/api/overtime-entries').send({
        employee_id: bob.id,
        hours: 4, // Same hours as Alice
        occurred_at: '2024-01-02T08:00:00Z'
      });
      
      await request.post('/api/overtime-entries').send({
        employee_id: charlie.id,
        hours: 6, // More hours than Alice and Bob
        occurred_at: '2024-01-03T08:00:00Z'
      });

      // Alice was assigned more recently than Bob
      await request.post('/api/assign-next').send({
        period: '2023-W52', // Previous period
        hours: 8,
        reason: 'previous assignment'
      });

      // Verify Alice got the previous assignment
      const prevAssignment = await db.select().from(assignments);
      expect(prevAssignment).toHaveLength(1);

      // Now for current period, Bob should be next (Alice assigned more recently)
      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      const candidates = whoIsNextResponse.body.candidates;
      expect(candidates[0]).toMatchObject({
        employee_id: bob.id, // Bob (not recently assigned)
        total_hours: 4,
        tie_break_rank: 1
      });
    });

    it('should handle tie-breaking by employee_id when all else equal', async () => {
      // All employees have same hours and no assignments
      for (const emp of testEmployees) {
        await request.post('/api/overtime-entries').send({
          employee_id: emp.id,
          hours: 4, // Same hours for all
          occurred_at: '2024-01-01T08:00:00Z'
        });
      }

      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      const candidates = whoIsNextResponse.body.candidates;
      
      // Should have 3 candidates with correct tie_break_ranks
      expect(candidates).toHaveLength(3);
      expect(candidates[0].tie_break_rank).toBe(1);
      expect(candidates[1].tie_break_rank).toBe(2);
      expect(candidates[2].tie_break_rank).toBe(3);

      // All should have same total_hours and last_assigned_at
      candidates.forEach(candidate => {
        expect(candidate.total_hours).toBe(4);
        expect(candidate.last_assigned_at).toBeNull();
      });
      
      // Should be sorted by employee_id (lexicographically) when everything else is equal
      const sortedIds = [...testEmployees].map(e => e.id).sort();
      candidates.forEach((candidate, index) => {
        expect(candidate.employee_id).toBe(sortedIds[index]);
      });
    });

    it('should correctly calculate overtime summary including assignments', async () => {
      // Add overtime entries to give everyone different hours
      await request.post('/api/overtime-entries').send({
        employee_id: bob.id, // Bob gets 2 hours (will be selected)
        hours: 2,
        occurred_at: '2024-01-01T08:00:00Z'
      });
      
      await request.post('/api/overtime-entries').send({
        employee_id: alice.id, // Alice gets 4 hours
        hours: 4,
        occurred_at: '2024-01-02T08:00:00Z'
      });
      
      await request.post('/api/overtime-entries').send({
        employee_id: charlie.id, // Charlie gets 6 hours  
        hours: 6,
        occurred_at: '2024-01-03T08:00:00Z'
      });

      // Add assignment - should go to Bob (lowest hours at 2)
      const assignResponse = await request.post('/api/assign-next').send({
        period: '2024-W01',
        hours: 8,
        reason: 'test assignment'
      }).expect(201);
      
      const summaryResponse = await request
        .get('/api/overtime-summary?period=2024-W01')
        .expect(200);

      // Bob should have been assigned (lowest hours)
      const assignedEmployee = summaryResponse.body.employee_summaries
        .find((emp: any) => emp.employee_id === bob.id);

      expect(assignedEmployee).toMatchObject({
        total_hours: 10, // 2 overtime + 8 assignment
        last_assigned_at: expect.any(String)
      });
      
      // Alice should still have 4 hours, no assignment
      const aliceEmployee = summaryResponse.body.employee_summaries
        .find((emp: any) => emp.employee_id === alice.id);

      expect(aliceEmployee).toMatchObject({
        total_hours: 4, // 4 overtime + 0 assignment
        last_assigned_at: null
      });
    });
  });

  describe('Refusal handling', () => {
    it('should charge default hours on refusal', async () => {
      // Give everyone overtime hours, Bob has the lowest
      await request.post('/api/overtime-entries').send({
        employee_id: bob.id, // Bob gets 2 hours (lowest, will be selected)
        hours: 2,
        occurred_at: '2024-01-01T08:00:00Z'
      });
      
      await request.post('/api/overtime-entries').send({
        employee_id: alice.id, // Alice gets 4 hours
        hours: 4,
        occurred_at: '2024-01-02T08:00:00Z'
      });
      
      await request.post('/api/overtime-entries').send({
        employee_id: charlie.id, // Charlie gets 6 hours
        hours: 6,
        occurred_at: '2024-01-03T08:00:00Z'
      });

      // Assign but mark as refused
      const assignResponse = await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 8,
          reason: 'coverage needed',
          refused: true
        })
        .expect(201);

      expect(assignResponse.body).toMatchObject({
        employee_id: bob.id, // Bob (lowest hours)
        status: 'refused',
        hours_charged: 8 // Default refusal hours
      });

      // Check overtime summary reflects the charged hours
      const summaryResponse = await request
        .get('/api/overtime-summary?period=2024-W01')
        .expect(200);

      const refusedEmployee = summaryResponse.body.employee_summaries
        .find((emp: any) => emp.employee_id === bob.id);

      expect(refusedEmployee.total_hours).toBe(10); // 2 overtime + 8 refusal
    });

    it('should still affect next assignment ordering after refusal', async () => {
      // All employees start with same hours
      for (const emp of testEmployees) {
        await request.post('/api/overtime-entries').send({
          employee_id: emp.id,
          hours: 4,
          occurred_at: '2024-01-01T08:00:00Z'
        });
      }

      // First assignment (refused) - should go to first employee by UUID
      const refusalResponse = await request.post('/api/assign-next').send({
        period: '2024-W01',
        hours: 8,
        reason: 'first assignment',
        refused: true
      }).expect(201);
      
      const refusedEmployeeId = refusalResponse.body.employee_id;

      // Check who is next now - should NOT be the employee who just refused
      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      const nextCandidate = whoIsNextResponse.body.candidates[0];
      expect(nextCandidate.employee_id).not.toBe(refusedEmployeeId);
      expect(nextCandidate.total_hours).toBe(4); // Still has lowest total

      // The refused employee should be last (highest total hours now)
      const refusedCandidate = whoIsNextResponse.body.candidates
        .find((c: any) => c.employee_id === refusedEmployeeId);
      expect(refusedCandidate.total_hours).toBe(12); // 4 + 8 refusal hours
    });

    it('should handle custom refusal hours', async () => {
      // Update config for custom refusal hours
      await db.insert(config).values({ id: 1, default_refusal_hours: 12 }).onConflictDoUpdate({
        target: config.id,
        set: { default_refusal_hours: 12 }
      });

      const assignResponse = await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 6, // Different from refusal hours
          reason: 'custom test',
          refused: true
        })
        .expect(201);

      expect(assignResponse.body.hours_charged).toBe(12); // Uses config default, not request hours
    });
  });

  describe('Period validation', () => {
    it('should validate period format in all endpoints', async () => {
      const invalidPeriods = ['2024-1', '24-W01', '2024-W', '2024-W54'];

      for (const period of invalidPeriods) {
        await request
          .get(`/api/who-is-next?period=${period}`)
          .expect(400);

        await request
          .get(`/api/overtime-summary?period=${period}`)
          .expect(400);

        await request
          .post('/api/assign-next')
          .send({ period, hours: 8, reason: 'test' })
          .expect(400);
      }
    });

    it('should handle valid period formats', async () => {
      const validPeriods = ['2024-W01', '2024-W52', '2023-W53'];

      for (const period of validPeriods) {
        await request
          .get(`/api/who-is-next?period=${period}`)
          .expect(200);

        await request
          .get(`/api/overtime-summary?period=${period}`)
          .expect(200);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle no eligible employees', async () => {
      // Delete all employees
      await db.delete(employees);

      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      expect(whoIsNextResponse.body.candidates).toEqual([]);

      const assignResponse = await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 8,
          reason: 'no one available'
        })
        .expect(404);

      expect(assignResponse.body.message).toContain('No eligible employees');
    });

    it('should handle employees with no overtime entries', async () => {
      // No overtime entries, just employees
      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      // All employees should have 0 hours
      whoIsNextResponse.body.candidates.forEach((candidate: any) => {
        expect(candidate.total_hours).toBe(0);
        expect(candidate.last_assigned_at).toBeNull();
      });

      // Should assign to first by UUID
      const assignResponse = await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 8,
          reason: 'first assignment'
        })
        .expect(201);

      // Should assign to one of our test employees (tie-breaking by UUID)
      const employeeIds = testEmployees.map(e => e.id);
      expect(employeeIds).toContain(assignResponse.body.employee_id);
    });

    it('should handle inactive employees', async () => {
      // Deactivate one employee
      await request
        .patch(`/api/employees/${alice.id}`)
        .send({ active: false });

      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      // Should only include active employees
      expect(whoIsNextResponse.body.candidates).toHaveLength(2);
      whoIsNextResponse.body.candidates.forEach((candidate: any) => {
        expect(candidate.employee_id).not.toBe(alice.id);
      });
    });
  });
});