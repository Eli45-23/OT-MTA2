import { Router } from 'express';
import type { Request, Response } from 'express';
import { createEmployeeSchema, updateEmployeeSchema, uuidParamSchema } from '../../contracts/schemas.js';
import { validateBody, validateParams } from '../lib/validation.js';
import { getAllEmployees, createEmployee, updateEmployee, getEmployeeById } from '../db/queries/employees.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const employees = await getAllEmployees();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch employees' });
  }
});

router.get('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) {
      res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    } else {
      res.json(employee);
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch employee' });
  }
});

router.post('/', validateBody(createEmployeeSchema), async (req: Request, res: Response) => {
  try {
    const employee = await createEmployee(req.body);
    if (!employee || !employee.id) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create employee - invalid response' });
    }
    res.status(201).json(employee);
  } catch (error: any) {
    console.error('Employee creation error:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'Conflict', message: 'Employee badge already exists' });
    } else if (error.message && error.message.includes('missing required fields')) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Database returned invalid data' });
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create employee', details: error.message });
    }
  }
});

router.patch('/:id', validateParams(uuidParamSchema), validateBody(updateEmployeeSchema), async (req: Request, res: Response) => {
  try {
    const employee = await updateEmployee(req.params.id, req.body);
    if (!employee) {
      return res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    } else {
      return res.json(employee);
    }
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'Employee badge already exists' });
    } else {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update employee' });
    }
  }
});

export default router;