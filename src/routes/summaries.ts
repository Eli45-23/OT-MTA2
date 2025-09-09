import { Router } from 'express';
import type { Request, Response } from 'express';
import { periodQuerySchema } from '../../contracts/schemas.js';
import { validateQuery } from '../lib/validation.js';
import { getOvertimeSummaryByPeriod } from '../db/queries/assignments.js';
import { isValidPeriodWeek } from '../lib/period.js';

const router = Router();

router.get('/', validateQuery(periodQuerySchema), async (req: Request, res: Response) => {
  try {
    const { period } = req.query as { period: string };
    
    // Additional period validation beyond regex
    if (!isValidPeriodWeek(period)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid period week format or date' 
      });
    }
    
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