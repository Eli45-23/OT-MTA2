import { Router } from 'express';
import type { Request, Response } from 'express';
import { createOvertimeEntrySchema } from '../../contracts/schemas.js';
import { validateBody } from '../lib/validation.js';
import { createOvertimeEntry } from '../db/queries/overtime-entries.js';

const router = Router();

router.post('/', validateBody(createOvertimeEntrySchema), async (req: Request, res: Response) => {
  try {
    const entry = await createOvertimeEntry(req.body);
    res.status(201).json(entry);
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({ error: 'Bad Request', message: 'Employee does not exist' });
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create overtime entry' });
    }
  }
});

export default router;