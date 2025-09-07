import { pgTable, uuid, text, boolean, timestamp, numeric, integer, check } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Employees table
export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  badge: text('badge').notNull().unique(),
  active: boolean('active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  nameCheck: check('name_length', `length(${table.name}) > 0 AND length(${table.name}) <= 100`),
  badgeCheck: check('badge_length', `length(${table.badge}) > 0 AND length(${table.badge}) <= 20`),
}));

// Overtime entries table
export const overtimeEntries = pgTable('overtime_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  employee_id: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  hours: numeric('hours', { precision: 5, scale: 2 }).notNull(),
  occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull(),
  source: text('source').notNull().default('manual'),
  note: text('note'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  hoursCheck: check('hours_range', `${table.hours} >= 0 AND ${table.hours} <= 24`),
  sourceCheck: check('source_enum', `${table.source} IN ('manual', 'import')`),
  noteCheck: check('note_length', `length(${table.note}) <= 500`),
}));

// Assignments table
export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  employee_id: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  period_week: text('period_week').notNull(),
  hours_charged: numeric('hours_charged', { precision: 5, scale: 2 }).notNull(),
  status: text('status').notNull(),
  decided_at: timestamp('decided_at', { withTimezone: true }),
  tie_break_rank: integer('tie_break_rank').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  periodCheck: check('period_format', `${table.period_week} ~ '^\\d{4}-W\\d{2}$'`),
  hoursChargedCheck: check('hours_charged_range', `${table.hours_charged} >= 0`),
  statusCheck: check('status_enum', `${table.status} IN ('assigned', 'refused', 'completed')`),
}));

// Configuration table
export const config = pgTable('config', {
  id: integer('id').primaryKey().$default(() => 1),
  default_refusal_hours: numeric('default_refusal_hours', { precision: 5, scale: 2 }).notNull().default('8'),
}, (table) => ({
  idCheck: check('single_row', `${table.id} = 1`),
  refusalHoursCheck: check('refusal_hours_range', `${table.default_refusal_hours} >= 0 AND ${table.default_refusal_hours} <= 24`),
}));

// Relations
export const employeesRelations = relations(employees, ({ many }) => ({
  overtimeEntries: many(overtimeEntries),
  assignments: many(assignments),
}));

export const overtimeEntriesRelations = relations(overtimeEntries, ({ one }) => ({
  employee: one(employees, {
    fields: [overtimeEntries.employee_id],
    references: [employees.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  employee: one(employees, {
    fields: [assignments.employee_id],
    references: [employees.id],
  }),
}));