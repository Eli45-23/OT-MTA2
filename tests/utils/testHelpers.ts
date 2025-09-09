import { db } from '../../src/db/connection.js';
import { resetDb } from '../../src/db/testReset.js';
import { TEST_RUN_ID } from '../setup.js';

// Unified database reset with proper error handling
export async function resetTestDatabase(): Promise<void> {
  try {
    await resetDb(db);
  } catch (error) {
    console.error('Database reset failed:', error);
    throw error;
  }
}

// Generate unique badge for test isolation (max 20 chars)
export function createTestBadge(baseBadge: string, testName?: string): string {
  const timestamp = Date.now().toString(36).slice(-4); // 4 chars
  const random = Math.random().toString(36).slice(-2); // 2 chars  
  const testId = testName ? testName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) : 'T';
  
  // Format: baseBadge_testId_timestamp_random (max 20 chars)
  let result = `${baseBadge}_${testId}_${timestamp}_${random}`;
  
  // Truncate to 20 chars if needed, preserving uniqueness at the end
  if (result.length > 20) {
    const uniquePart = `_${timestamp}_${random}`; // Keep unique suffix
    const prefixLength = 20 - uniquePart.length;
    result = result.slice(0, prefixLength) + uniquePart;
  }
  
  return result;
}

// Helper to create employees with unique badges
export function createTestEmployeeData(testName?: string) {
  return [
    { name: 'Alice Smith', badge: createTestBadge('AS001', testName) },
    { name: 'Bob Johnson', badge: createTestBadge('BJ002', testName) },
    { name: 'Charlie Brown', badge: createTestBadge('CB003', testName) }
  ];
}

// Helper to find employee by name in test results
export function findEmployeeByName(employees: any[], name: string): any {
  return employees.find(emp => emp.name === name);
}

// Helper to find employee by badge prefix
export function findEmployeeByBadgePrefix(employees: any[], badgePrefix: string): any {
  return employees.find(emp => emp.badge.startsWith(badgePrefix));
}

// Sort employees consistently for predictable testing
export function sortEmployeesByName(employees: any[]): any[] {
  return [...employees].sort((a, b) => a.name.localeCompare(b.name));
}

// Sort employees by ID for tie-breaking tests
export function sortEmployeesById(employees: any[]): any[] {
  return [...employees].filter(emp => emp && emp.id).sort((a, b) => a.id.localeCompare(b.id));
}