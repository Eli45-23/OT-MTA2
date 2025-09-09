import { Router } from 'express';
import type { Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { periodQuerySchema, assignNextSchema } from '../../contracts/schemas.js';
import { validateQuery, validateBody } from '../lib/validation.js';
import { orderCandidates, getNextEmployee } from '../lib/selection.js';
import { isValidPeriodWeek } from '../lib/period.js';
import { createAssignment, getAssignmentByEmployeePeriod } from '../db/queries/assignments.js';
import { mapAssignmentRow } from '../db/mappers.js';
import { db } from '../db/connection.js';
import { config as dbConfig, assignments } from '../db/schema.js';
import { config } from '../config.js';

const router = Router();

router.get('/who-is-next', validateQuery(periodQuerySchema), async (req: Request, res: Response) => {
  try {
    const { period } = req.query as { period: string };
    
    // Additional period validation beyond regex
    if (!isValidPeriodWeek(period)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid period week format or date' 
      });
    }
    
    const candidates = await orderCandidates(period);
    res.json({
      period_week: period,
      candidates
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get candidates' });
  }
});

router.post('/assign-next', validateBody(assignNextSchema), async (req: Request, res: Response) => {
  const { period, hours, reason, refused = false } = req.body;
  
  try {
    
    // Additional period validation beyond regex
    if (!isValidPeriodWeek(period)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid period week format or date' 
      });
    }

    // Use transaction with advisory locking for stronger race condition prevention
    const result = await db.transaction(async (tx) => {
      // Use advisory lock for the period to prevent concurrent assignments
      const lockId = period.split('-').map((p: string) => p.charCodeAt(0)).reduce((a: number, b: number) => a + b, 0);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);
      
      // Get candidates atomically within transaction
      const candidates = await orderCandidates(period, tx);
      if (candidates.length === 0) {
        throw new Error('NO_CANDIDATES');
      }

      const nextEmployee = candidates[0];

      // Check for existing assignment for this specific employee in this period
      const existingForEmployee = await tx.select()
        .from(assignments)
        .where(and(
          eq(assignments.employee_id, nextEmployee.employee_id),
          eq(assignments.period_week, period)
        ));

      if (existingForEmployee.length > 0) {
        throw new Error('ALREADY_ASSIGNED');
      }

      // Get default refusal hours if needed
      let hoursToCharge = hours;
      if (refused) {
        const configResult = await tx.select().from(dbConfig);
        hoursToCharge = Number(configResult[0]?.default_refusal_hours || 8);
      }

      // Create assignment atomically
      const assignment = await tx.insert(assignments).values({
        employee_id: nextEmployee.employee_id,
        period_week: period,
        hours_charged: hoursToCharge.toString(),
        status: refused ? 'refused' : 'assigned',
        decided_at: null,
        tie_break_rank: nextEmployee.tie_break_rank
      }).returning();

      if (!assignment[0]) {
        throw new Error('ASSIGNMENT_CREATION_FAILED');
      }

      return mapAssignmentRow(assignment[0]);
    });

    res.status(201).json(result);

  } catch (error: any) {
    // Enhanced logging for debugging concurrent assignment issues
    const errorContext = {
      period,
      hours,
      refused,
      timestamp: new Date().toISOString(),
      errorType: error.constructor.name,
      errorCode: error.code,
      errorMessage: error.message
    };
    
    // Only log to console in test environment, not in production
    if (config.isTest()) {
      console.error('Assignment error:', errorContext);
    }
    
    // Handle specific transaction errors
    if (error.message === 'NO_CANDIDATES') {
      return res.status(404).json({ 
        error: 'Not Found', 
        message: 'No eligible employees available' 
      });
    }
    
    if (error.message === 'ALREADY_ASSIGNED') {
      return res.status(409).json({ 
        error: 'Conflict', 
        message: 'Employee already assigned for this period' 
      });
    }
    
    if (error.message === 'ASSIGNMENT_CREATION_FAILED') {
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to create assignment record' 
      });
    }
    
    // Handle database constraint violations
    if (error.code === '23505') {
      // Parse constraint details for better error messages
      const isAssignmentConstraint = error.constraint_name?.includes('assignments_employee_period_unique') || 
                                    error.detail?.includes('employee_id, period_week');
                                    
      return res.status(409).json({ 
        error: 'Conflict', 
        message: isAssignmentConstraint 
          ? 'Assignment already exists for this period' 
          : 'Database constraint violation'
      });
    }
    
    // Handle connection/timeout errors
    if (error.code === '57P01' || error.message?.includes('timeout') || error.message?.includes('connection')) {
      return res.status(503).json({ 
        error: 'Service Temporarily Unavailable', 
        message: 'Database connection issue, please retry' 
      });
    }
    
    // Generic error handler
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to create assignment',
      ...(config.isTest() && { details: error.message }) // Include details only in test environment
    });
  }
});

export default router;