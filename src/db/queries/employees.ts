import { db } from '../connection.js';
import { employees } from '../schema.js';
import type { Employee, CreateEmployee, UpdateEmployee } from '../../../contracts/schemas.js';

export async function getAllEmployees(): Promise<Employee[]> {
  throw new Error('Not implemented');
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  throw new Error('Not implemented');
}

export async function createEmployee(data: CreateEmployee): Promise<Employee> {
  throw new Error('Not implemented');
}

export async function updateEmployee(id: string, data: UpdateEmployee): Promise<Employee | null> {
  throw new Error('Not implemented');
}