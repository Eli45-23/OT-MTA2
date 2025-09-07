import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { employees } from '../schema.js';
import type { Employee, CreateEmployee, UpdateEmployee } from '../../../contracts/schemas.js';

export async function getAllEmployees(): Promise<Employee[]> {
  return await db.select().from(employees);
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const result = await db.select().from(employees).where(eq(employees.id, id));
  return result[0] || null;
}

export async function createEmployee(data: CreateEmployee): Promise<Employee> {
  const result = await db.insert(employees).values(data).returning();
  return result[0];
}

export async function updateEmployee(id: string, data: UpdateEmployee): Promise<Employee | null> {
  const result = await db.update(employees).set(data).where(eq(employees.id, id)).returning();
  return result[0] || null;
}