import { z } from 'zod';

// Employee schemas
export const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  badge: z.string().min(1).max(20),
  active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
});

export const createEmployeeSchema = employeeSchema.omit({ id: true, created_at: true });
export const updateEmployeeSchema = employeeSchema.partial().omit({ id: true, created_at: true });

// Overtime entry schemas
export const overtimeEntrySchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  hours: z.number().min(0).max(24).multipleOf(0.01),
  occurred_at: z.string().datetime(),
  source: z.enum(['manual', 'import']).default('manual'),
  note: z.string().max(500).optional(),
  created_at: z.string().datetime().optional(),
});

export const createOvertimeEntrySchema = overtimeEntrySchema.omit({ id: true, created_at: true });

// Assignment schemas
export const assignmentSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  period_week: z.string().regex(/^\d{4}-W\d{2}$/),
  hours_charged: z.number().min(0),
  status: z.enum(['assigned', 'refused', 'completed']),
  decided_at: z.string().datetime().nullable().optional(),
  tie_break_rank: z.number().int(),
  created_at: z.string().datetime().optional(),
});

export const assignNextSchema = z.object({
  period: z.string().regex(/^\d{4}-W\d{2}$/),
  hours: z.number().min(0).max(24).default(8),
  reason: z.string().min(1),
  refused: z.boolean().default(false),
});

// Summary schemas
export const employeeSummarySchema = z.object({
  employee_id: z.string().uuid(),
  name: z.string(),
  badge: z.string(),
  total_hours: z.number(),
  last_assigned_at: z.string().datetime().nullable(),
});

export const overtimeSummarySchema = z.object({
  period_week: z.string().regex(/^\d{4}-W\d{2}$/),
  employee_summaries: z.array(employeeSummarySchema),
});

// Who is next schemas
export const candidateSchema = z.object({
  employee_id: z.string().uuid(),
  name: z.string(),
  badge: z.string(),
  total_hours: z.number(),
  last_assigned_at: z.string().datetime().nullable(),
  tie_break_rank: z.number().int(),
});

export const whoIsNextSchema = z.object({
  period_week: z.string().regex(/^\d{4}-W\d{2}$/),
  candidates: z.array(candidateSchema),
});

// Config schemas
export const configSchema = z.object({
  default_refusal_hours: z.number().min(0).max(24).default(8),
});

// Error schemas
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
});

// Query parameter schemas
export const periodQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-W\d{2}$/),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

// Type exports
export type Employee = z.infer<typeof employeeSchema>;
export type CreateEmployee = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;
export type OvertimeEntry = z.infer<typeof overtimeEntrySchema>;
export type CreateOvertimeEntry = z.infer<typeof createOvertimeEntrySchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type AssignNext = z.infer<typeof assignNextSchema>;
export type EmployeeSummary = z.infer<typeof employeeSummarySchema>;
export type OvertimeSummary = z.infer<typeof overtimeSummarySchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type WhoIsNext = z.infer<typeof whoIsNextSchema>;
export type Config = z.infer<typeof configSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type PeriodQuery = z.infer<typeof periodQuerySchema>;
export type UuidParam = z.infer<typeof uuidParamSchema>;