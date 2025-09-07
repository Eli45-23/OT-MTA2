import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// GET /overtime-summary?period=YYYY-WW
router.get('/', async (req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'GET /overtime-summary endpoint not yet implemented'
  });
});

export default router;