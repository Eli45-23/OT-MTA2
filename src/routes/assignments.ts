import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// GET /who-is-next?period=YYYY-WW
router.get('/who-is-next', async (req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'GET /who-is-next endpoint not yet implemented'
  });
});

// POST /assign-next
router.post('/assign-next', async (req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'POST /assign-next endpoint not yet implemented'
  });
});

export default router;