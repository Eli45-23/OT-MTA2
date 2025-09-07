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
    res.status(201).json(employee);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Conflict', message: 'Employee badge already exists' });
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create employee' });
    }
  }
});

router.patch('/:id', validateParams(uuidParamSchema), validateBody(updateEmployeeSchema), async (req: Request, res: Response) => {
  try {
    const employee = await updateEmployee(req.params.id, req.body);
    if (!employee) {
      res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    } else {
      res.json(employee);
    }
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Conflict', message: 'Employee badge already exists' });
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update employee' });
    }
  }
});

export default router;