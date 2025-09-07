import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import supertest from 'supertest';
import app from '../../src/server.js';
import { db, client } from '../../src/db/connection.js';
import { employees, overtimeEntries, assignments, config } from '../../src/db/schema.js';
import './setup.js';

const request = supertest(app);

describe('Complete E2E Workflow Tests', () => {
  beforeAll(async () => {
    // Clean all tables and set up config
    await db.delete(assignments);
    await db.delete(overtimeEntries);
    await db.delete(employees);
    
    await db.insert(config).values({ id: 1, default_refusal_hours: 8 }).onConflictDoUpdate({
      target: config.id,
      set: { default_refusal_hours: 8 }
    });
  });

  afterAll(async () => {
    await db.delete(assignments);
    await db.delete(overtimeEntries);
    await db.delete(employees);
    await client.end();
  });

  beforeEach(async () => {
    // Clean slate for each test
    await db.delete(assignments);
    await db.delete(overtimeEntries);
    await db.delete(employees);
  });

  describe('End-to-end assignment workflow', () => {
    it('should complete full assignment cycle', async () => {
      // 1. Create 3 employees with predictable names for testing
      const employeeData = [
        { name: 'Alice Smith', badge: 'AS001' },
        { name: 'Bob Johnson', badge: 'BJ002' }, 
        { name: 'Charlie Brown', badge: 'CB003' }
      ];

      const employees = [];
      for (const empData of employeeData) {
        const response = await request
          .post('/api/employees')
          .send(empData)
          .expect(201);
        employees.push(response.body);
      }

      // Sort by employee ID for consistent ordering
      employees.sort((a, b) => a.id.localeCompare(b.id));

      // 2. Add overtime entries with different hours
      // Alice: 2 hours, Bob: 4 hours, Charlie: 2 hours  
      await request
        .post('/api/overtime-entries')
        .send({
          employee_id: employees[0].id, // Alice
          hours: 2,
          occurred_at: '2024-01-01T08:00:00Z'
        })
        .expect(201);

      await request
        .post('/api/overtime-entries')
        .send({
          employee_id: employees[1].id, // Bob  
          hours: 4,
          occurred_at: '2024-01-02T08:00:00Z'
        })
        .expect(201);

      await request
        .post('/api/overtime-entries')
        .send({
          employee_id: employees[2].id, // Charlie
          hours: 2, 
          occurred_at: '2024-01-03T08:00:00Z'
        })
        .expect(201);

      // 3. Call /overtime-summary to verify totals
      const summaryResponse = await request
        .get('/api/overtime-summary?period=2024-W01')
        .expect(200);

      expect(summaryResponse.body).toMatchObject({
        period_week: '2024-W01',
        employee_summaries: expect.arrayContaining([
          expect.objectContaining({
            employee_id: employees[0].id,
            name: 'Alice Smith',
            total_hours: 2,
            last_assigned_at: null
          }),
          expect.objectContaining({
            employee_id: employees[1].id, 
            name: 'Bob Johnson',
            total_hours: 4,
            last_assigned_at: null
          }),
          expect.objectContaining({
            employee_id: employees[2].id,
            name: 'Charlie Brown', 
            total_hours: 2,
            last_assigned_at: null
          })
        ])
      });

      // 4. Call /who-is-next to get ordered candidates
      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      expect(whoIsNextResponse.body.candidates).toHaveLength(3);
      
      // Alice and Charlie both have 2 hours, should be ordered by employee_id
      // Bob has 4 hours, should be last
      const candidates = whoIsNextResponse.body.candidates;
      expect(candidates[0].total_hours).toBe(2); // Lowest hours first
      expect(candidates[1].total_hours).toBe(2);
      expect(candidates[2].total_hours).toBe(4); // Highest hours last
      expect(candidates[2].employee_id).toBe(employees[1].id); // Bob

      // 5. Call /assign-next to assign to first candidate
      const firstAssignResponse = await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 8,
          reason: 'coverage needed'
        })
        .expect(201);

      expect(firstAssignResponse.body).toMatchObject({
        employee_id: candidates[0].employee_id,
        period_week: '2024-W01',
        hours_charged: 8,
        status: 'assigned',
        tie_break_rank: 1,
        decided_at: null
      });

      // 6. Verify assignment recorded and totals updated
      const updatedSummaryResponse = await request
        .get('/api/overtime-summary?period=2024-W01')
        .expect(200);

      const assignedEmployeeSummary = updatedSummaryResponse.body.employee_summaries
        .find((emp: any) => emp.employee_id === candidates[0].employee_id);

      expect(assignedEmployeeSummary).toMatchObject({
        total_hours: 10, // 2 original + 8 assigned
        last_assigned_at: expect.any(String)
      });

      // 7. Call /assign-next with refusal
      const refusalResponse = await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 8,
          reason: 'emergency coverage',
          refused: true
        })
        .expect(201);

      expect(refusalResponse.body).toMatchObject({
        status: 'refused',
        hours_charged: 8, // Default refusal hours
        decided_at: null
      });

      // 8. Verify refusal recorded and charged correctly
      const finalSummaryResponse = await request
        .get('/api/overtime-summary?period=2024-W01')
        .expect(200);

      const refusedEmployeeSummary = finalSummaryResponse.body.employee_summaries
        .find((emp: any) => emp.employee_id === refusalResponse.body.employee_id);

      expect(refusedEmployeeSummary.total_hours).toBeGreaterThanOrEqual(10); // Original hours + 8 refusal

      // Verify we now have 2 assignments in database
      const allAssignments = await db.select().from(assignments);
      expect(allAssignments).toHaveLength(2);
      expect(allAssignments.map(a => a.status)).toEqual(expect.arrayContaining(['assigned', 'refused']));
    });

    it('should handle complete workflow with multiple periods', async () => {
      // Create employee
      const employeeResponse = await request
        .post('/api/employees')
        .send({ name: 'Multi Period Employee', badge: 'MPE001' })
        .expect(201);

      const employee = employeeResponse.body;

      // Add overtime in different periods  
      await request.post('/api/overtime-entries').send({
        employee_id: employee.id,
        hours: 4,
        occurred_at: '2024-01-01T08:00:00Z' // Week 1
      });

      await request.post('/api/overtime-entries').send({
        employee_id: employee.id, 
        hours: 6,
        occurred_at: '2024-01-08T08:00:00Z' // Week 2
      });

      // Check summaries for different periods
      const week1Summary = await request
        .get('/api/overtime-summary?period=2024-W01')
        .expect(200);

      const week2Summary = await request
        .get('/api/overtime-summary?period=2024-W02')
        .expect(200);

      expect(week1Summary.body.employee_summaries[0].total_hours).toBe(4);
      expect(week2Summary.body.employee_summaries[0].total_hours).toBe(6);

      // Assignments in different periods should be independent
      await request.post('/api/assign-next').send({
        period: '2024-W01',
        hours: 8,
        reason: 'week 1 assignment'
      }).expect(201);

      await request.post('/api/assign-next').send({
        period: '2024-W02', 
        hours: 8,
        reason: 'week 2 assignment'
      }).expect(201);

      // Verify both assignments exist
      const assignments = await db.select().from(assignments);
      expect(assignments).toHaveLength(2);
      expect(assignments.map(a => a.period_week).sort()).toEqual(['2024-W01', '2024-W02']);
    });

    it('should handle workflow with employee deactivation', async () => {
      // Create employees
      const emp1 = await request.post('/api/employees').send({ name: 'Active Employee', badge: 'AE001' });
      const emp2 = await request.post('/api/employees').send({ name: 'To Be Deactivated', badge: 'TBD001' });

      const employee1 = emp1.body;
      const employee2 = emp2.body;

      // Both have same overtime initially
      await request.post('/api/overtime-entries').send({
        employee_id: employee1.id,
        hours: 4,
        occurred_at: '2024-01-01T08:00:00Z'
      });

      await request.post('/api/overtime-entries').send({
        employee_id: employee2.id,
        hours: 4, 
        occurred_at: '2024-01-01T08:00:00Z'
      });

      // Deactivate second employee
      await request
        .patch(`/api/employees/${employee2.id}`)
        .send({ active: false })
        .expect(200);

      // Only active employee should show in candidates
      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      expect(whoIsNextResponse.body.candidates).toHaveLength(1);
      expect(whoIsNextResponse.body.candidates[0].employee_id).toBe(employee1.id);

      // Assignment should go to active employee
      const assignResponse = await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 8,
          reason: 'only active employee'
        })
        .expect(201);

      expect(assignResponse.body.employee_id).toBe(employee1.id);
    });

    it('should handle workflow with no eligible employees', async () => {
      // Create employee but make inactive
      const empResponse = await request
        .post('/api/employees')
        .send({ name: 'Inactive Employee', badge: 'IE001' })
        .expect(201);

      await request
        .patch(`/api/employees/${empResponse.body.id}`)
        .send({ active: false })
        .expect(200);

      // Should have no candidates
      const whoIsNextResponse = await request
        .get('/api/who-is-next?period=2024-W01')
        .expect(200);

      expect(whoIsNextResponse.body.candidates).toEqual([]);

      // Assignment should fail
      await request
        .post('/api/assign-next')
        .send({
          period: '2024-W01',
          hours: 8,
          reason: 'no one available'
        })
        .expect(404);
    });
  });

  describe('API error handling', () => {
    beforeEach(async () => {
      // Create a test employee for error tests
      await request
        .post('/api/employees')
        .send({ name: 'Test Employee', badge: 'TE001' })
        .expect(201);
    });

    it('should handle invalid period formats', async () => {
      const invalidPeriods = [
        '2024-1',      // Missing W and leading zero
        '24-W01',      // Year too short
        '2024-W',      // Missing week number
        '2024-W54',    // Week number too high
        '2024-W00',    // Week number too low
        'invalid',     // Completely invalid
        ''             // Empty string
      ];

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

    it('should handle non-existent employee IDs', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';

      // Overtime entry with fake employee ID
      await request
        .post('/api/overtime-entries')
        .send({
          employee_id: fakeId,
          hours: 4,
          occurred_at: '2024-01-01T08:00:00Z'
        })
        .expect(400); // Should fail foreign key constraint

      // Update fake employee ID  
      await request
        .patch(`/api/employees/${fakeId}`)
        .send({ name: 'Updated Name' })
        .expect(404);
    });

    it('should handle malformed request bodies', async () => {
      // Invalid employee creation
      const invalidEmployees = [
        {}, // Missing required fields
        { name: 'Test' }, // Missing badge
        { badge: 'TEST' }, // Missing name
        { name: '', badge: 'TEST' }, // Empty name
        { name: 'Test', badge: '' }, // Empty badge
        { name: 'A'.repeat(101), badge: 'TEST' }, // Name too long
        { name: 'Test', badge: 'B'.repeat(21) }, // Badge too long
      ];

      for (const emp of invalidEmployees) {
        await request
          .post('/api/employees')
          .send(emp)
          .expect(400);
      }

      // Invalid overtime entries
      const invalidEntries = [
        {}, // Missing all fields
        { employee_id: '123e4567-e89b-12d3-a456-426614174000' }, // Missing hours/date
        { hours: 4 }, // Missing employee_id/date
        { hours: -1, employee_id: '123e4567-e89b-12d3-a456-426614174000', occurred_at: '2024-01-01T08:00:00Z' }, // Negative hours
        { hours: 25, employee_id: '123e4567-e89b-12d3-a456-426614174000', occurred_at: '2024-01-01T08:00:00Z' }, // Hours too high
        { hours: 4, employee_id: 'not-a-uuid', occurred_at: '2024-01-01T08:00:00Z' }, // Invalid UUID
        { hours: 4, employee_id: '123e4567-e89b-12d3-a456-426614174000', occurred_at: 'invalid-date' }, // Invalid date
      ];

      for (const entry of invalidEntries) {
        await request
          .post('/api/overtime-entries')
          .send(entry)
          .expect(400);
      }

      // Invalid assignments
      const invalidAssignments = [
        {}, // Missing all fields
        { period: '2024-W01' }, // Missing hours/reason
        { hours: 8, reason: 'test' }, // Missing period
        { period: 'invalid', hours: 8, reason: 'test' }, // Invalid period
        { period: '2024-W01', hours: -1, reason: 'test' }, // Negative hours
        { period: '2024-W01', hours: 8, reason: '' }, // Empty reason
      ];

      for (const assignment of invalidAssignments) {
        await request
          .post('/api/assign-next')
          .send(assignment)
          .expect(400);
      }
    });

    it('should handle malformed JSON requests', async () => {
      // Send invalid JSON
      const response = await request
        .post('/api/employees')
        .set('Content-Type', 'application/json')
        .send('{"name": "Test", "badge":}') // Invalid JSON
        .expect(400);

      expect(response.body.error).toContain('Bad Request');
    });

    it('should handle missing Content-Type header', async () => {
      // Send data without proper content type
      await request
        .post('/api/employees')
        .send('name=Test&badge=TEST')
        .expect(400);
    });

    it('should return proper error codes for different scenarios', async () => {
      // 400 - Bad Request (validation errors)
      await request
        .post('/api/employees')
        .send({ name: '', badge: 'TEST' })
        .expect(400);

      // 404 - Not Found
      await request
        .patch('/api/employees/123e4567-e89b-12d3-a456-426614174000')
        .send({ name: 'Test' })
        .expect(404);

      // 409 - Conflict (duplicate badge)
      await request
        .post('/api/employees')
        .send({ name: 'First', badge: 'DUPLICATE' })
        .expect(201);

      await request
        .post('/api/employees')
        .send({ name: 'Second', badge: 'DUPLICATE' })
        .expect(409);
    });

    it('should provide helpful error messages', async () => {
      // Validation error should include field details
      const response = await request
        .post('/api/employees')
        .send({ name: '', badge: 'B'.repeat(25) })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
        message: expect.any(String),
        details: expect.arrayContaining([
          expect.objectContaining({ path: ['name'] }),
          expect.objectContaining({ path: ['badge'] })
        ])
      });

      // Not found error should be descriptive
      const notFoundResponse = await request
        .patch('/api/employees/123e4567-e89b-12d3-a456-426614174000')
        .send({ name: 'Test' })
        .expect(404);

      expect(notFoundResponse.body.message).toContain('Employee');
    });
  });
});