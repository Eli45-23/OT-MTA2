import { Router } from 'express';
import type { Request, Response } from 'express';
import { periodQuerySchema, assignNextSchema } from '../../contracts/schemas.js';
import { validateQuery, validateBody } from '../lib/validation.js';
import { orderCandidates, getNextEmployee } from '../lib/selection.js';
import { createAssignment, getAssignmentByEmployeePeriod } from '../db/queries/assignments.js';
import { db } from '../db/connection.js';
import { config } from '../db/schema.js';

const router = Router();

router.get('/who-is-next', validateQuery(periodQuerySchema), async (req: Request, res: Response) => {
  try {
    const { period } = req.query as { period: string };
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
    
    const nextEmployee = await getNextEmployee(period);
    if (!nextEmployee) {
      return res.status(404).json({ error: 'Not Found', message: 'No eligible employees available' });
    }

    const existing = await getAssignmentByEmployeePeriod(nextEmployee.employee_id, period);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Employee already assigned for this period' });
    }

    let hoursToCharge = hours;
    if (refused) {
      const configResult = await db.select().from(config);
      hoursToCharge = Number(configResult[0]?.default_refusal_hours || 8);
    }

    const assignment = await createAssignment({
      employee_id: nextEmployee.employee_id,
      period_week: period,
      hours_charged: hoursToCharge,
      status: refused ? 'refused' : 'assigned',
      decided_at: null,
      tie_break_rank: nextEmployee.tie_break_rank
    });

    res.status(201).json(assignment);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Conflict', message: 'Employee already assigned for this period' });
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create assignment' });
    }
  }
});

export default router;