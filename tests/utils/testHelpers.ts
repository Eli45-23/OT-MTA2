import { db } from '../../src/db/connection.js';
import { resetDb } from '../../src/db/testReset.js';
import { TEST_RUN_ID } from '../setup.js';
import { employees, assignments, overtimeEntries } from '../../src/db/schema.js';

// Counter for ensuring badge uniqueness within same process/timestamp
let badgeCounter = 0;

// Mutex to serialize database resets across concurrent tests  
let resetMutex = Promise.resolve();

// Unified database reset with proper error handling and validation
export async function resetTestDatabase(): Promise<void> {
  // Wait for any previous reset to complete, then acquire the mutex
  resetMutex = resetMutex.then(async () => {
    try {
      await resetDb(db);
      
      // Simple delay to ensure database operations have fully completed
      await new Promise(resolve => setTimeout(resolve, 10));
      
    } catch (error) {
      console.error('Database reset failed:', error);
      throw error;
    }
  });
  
  // Wait for this reset to complete
  await resetMutex;
}

// Generate unique badge for test isolation with enhanced uniqueness (max 20 chars)
export function createTestBadge(baseBadge: string, testName?: string): string {
  // Use multiple uniqueness factors to virtually eliminate collisions
  const nanoTime = (performance.now() * 1000000).toString(36).slice(-4); // 4 chars from nanosecond precision
  const processCounter = (++badgeCounter % 46656).toString(36).padStart(3, '0'); // 3 chars (base36: 000-ZZZ)  
  const processId = (process.pid % 1296).toString(36).padStart(2, '0'); // 2 chars
  const random = Math.random().toString(36).slice(-2); // 2 chars
  const testId = testName ? testName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) : 'T';
  
  // Format: baseBadge_testId_nanoTime_processCounter_processId_random (max 20 chars)
  let result = `${baseBadge}_${testId}_${nanoTime}${processCounter}${processId}${random}`;
  
  // Truncate to 20 chars if needed, preserving uniqueness at the end
  if (result.length > 20) {
    const uniquePart = `_${nanoTime}${processCounter}${processId}${random}`; // Keep unique suffix
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

// Validate that test setup is complete and data exists
export async function validateTestSetup(expectedEmployeeCount: number = 3): Promise<void> {
  let attempts = 0;
  const maxAttempts = 10;
  const delay = 50;
  
  while (attempts < maxAttempts) {
    try {
      // Check that expected employees exist
      const employeesResult = await db.select().from(employees);
      
      if (employeesResult.length >= expectedEmployeeCount) {
        // Additional validation: ensure employees have valid UUIDs and names
        const validEmployees = employeesResult.filter(emp => 
          emp.id && emp.name && emp.badge && emp.id.length > 10
        );
        
        if (validEmployees.length >= expectedEmployeeCount) {
          // Extra small delay to ensure all database operations are committed
          await new Promise(resolve => setTimeout(resolve, 10));
          return;
        }
      }
      
      // If not ready, wait and retry
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
      
    } catch (error) {
      console.warn(`Test setup validation attempt ${attempts + 1} failed:`, error);
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error(`Test setup validation failed after ${maxAttempts} attempts: ${error}`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Test setup validation failed - expected ${expectedEmployeeCount} employees but validation timed out`);
}

// Helper to ensure API calls wait for test setup completion
export async function waitForTestDataReady(expectedEmployeeCount: number = 3): Promise<void> {
  await validateTestSetup(expectedEmployeeCount);
}