import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// POST /overtime-entries
router.post('/', async (req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'POST /overtime-entries endpoint not yet implemented'
  });
});

export default router;