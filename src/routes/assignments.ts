import { Router } from 'express';
import type { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { periodQuerySchema, assignNextSchema } from '../../contracts/schemas.js';
import { validateQuery, validateBody } from '../lib/validation.js';
import { orderCandidates, getNextEmployee } from '../lib/selection.js';
import { isValidPeriodWeek } from '../lib/period.js';
import { createAssignment, getAssignmentByEmployeePeriod } from '../db/queries/assignments.js';
import { mapAssignmentRow } from '../db/mappers.js';
import { db } from '../db/connection.js';
import { config, assignments } from '../db/schema.js';

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
  try {
    const { period, hours, reason, refused = false } = req.body;
    
    // Additional period validation beyond regex
    if (!isValidPeriodWeek(period)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid period week format or date' 
      });
    }

    // Use transaction for atomicity and race condition prevention
    const result = await db.transaction(async (tx) => {
      // Get candidates atomically within transaction
      const candidates = await orderCandidates(period, tx);
      if (candidates.length === 0) {
        throw new Error('NO_CANDIDATES');
      }

      const nextEmployee = candidates[0];

      // Check for existing assignment with SELECT FOR UPDATE to prevent races
      const existing = await tx.select()
        .from(assignments)
        .where(and(
          eq(assignments.employee_id, nextEmployee.employee_id),
          eq(assignments.period_week, period)
        ))
        .for('update');

      if (existing.length > 0) {
        throw new Error('ALREADY_ASSIGNED');
      }

      // Get default refusal hours if needed
      let hoursToCharge = hours;
      if (refused) {
        const configResult = await tx.select().from(config);
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
    console.error('Assignment error:', error);
    
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
      return res.status(409).json({ 
        error: 'Conflict', 
        message: 'Employee already assigned for this period' 
      });
    } else {
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to create assignment',
        details: error.message
      });
    }
  }
});

export default router;