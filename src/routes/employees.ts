import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// GET /employees
router.get('/', async (req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'GET /employees endpoint not yet implemented'
  });
});

// POST /employees
router.post('/', async (req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'POST /employees endpoint not yet implemented'
  });
});

// PATCH /employees/:id
router.patch('/:id', async (req: Request, res: Response) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'PATCH /employees/:id endpoint not yet implemented'
  });
});

export default router;