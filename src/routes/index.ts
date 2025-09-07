import { Router } from 'express';
import employeesRouter from './employees.js';
import overtimeEntriesRouter from './overtime-entries.js';
import summariesRouter from './summaries.js';
import assignmentsRouter from './assignments.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route modules
router.use('/employees', employeesRouter);
router.use('/overtime-entries', overtimeEntriesRouter);
router.use('/overtime-summary', summariesRouter);
router.use('/assignments', assignmentsRouter);
router.use('/', assignmentsRouter); // Also mount at root for backward compatibility

export default router;