import { Router } from 'express';
import type { Request, Response } from 'express';
import { periodQuerySchema } from '../../contracts/schemas.js';
import { validateQuery } from '../lib/validation.js';
import { getOvertimeSummaryByPeriod } from '../db/queries/assignments.js';

const router = Router();

router.get('/', validateQuery(periodQuerySchema), async (req: Request, res: Response) => {
  try {
    const { period } = req.query as { period: string };
    const employee_summaries = await getOvertimeSummaryByPeriod(period);
    res.json({
      period_week: period,
      employee_summaries
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get overtime summary' });
  }
});

export default router;