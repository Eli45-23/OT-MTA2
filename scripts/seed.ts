#!/usr/bin/env tsx

import { db } from '../src/db/connection.js';
import { employees, overtimeEntries, config } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const sampleEmployees = [
  { name: 'Alice Johnson', badge: 'A001' },
  { name: 'Bob Smith', badge: 'B002' },
  { name: 'Charlie Brown', badge: 'C003' },
];

const sampleOvertimeEntries = [
  {
    badge: 'A001',
    hours: '4.5',
    occurred_at: new Date('2024-01-15T08:00:00Z'),
    source: 'manual' as const,
    note: 'Emergency maintenance',
  },
  {
    badge: 'B002', 
    hours: '2.0',
    occurred_at: new Date('2024-01-20T14:30:00Z'),
    source: 'manual' as const,
    note: 'Project deadline',
  },
  {
    badge: 'C003',
    hours: '6.0', 
    occurred_at: new Date('2024-01-25T16:00:00Z'),
    source: 'manual' as const,
    note: 'System upgrade',
  },
  {
    badge: 'A001',
    hours: '3.0',
    occurred_at: new Date('2024-02-01T09:15:00Z'),
    source: 'manual' as const,
    note: 'Training session',
  },
];

async function seed() {
  console.log('🌱 Starting database seed...');
  
  try {
    // Insert employees (upsert based on badge)
    console.log('👥 Seeding employees...');
    const insertedEmployees: { id: string; badge: string }[] = [];
    
    for (const emp of sampleEmployees) {
      const existing = await db
        .select()
        .from(employees)
        .where(eq(employees.badge, emp.badge))
        .limit(1);
      
      if (existing.length === 0) {
        const [inserted] = await db
          .insert(employees)
          .values(emp)
          .returning({ id: employees.id, badge: employees.badge });
        insertedEmployees.push(inserted);
        console.log(`  ✅ Created employee: ${emp.name} (${emp.badge})`);
      } else {
        insertedEmployees.push({ id: existing[0].id, badge: existing[0].badge });
        console.log(`  ♻️  Employee exists: ${emp.name} (${emp.badge})`);
      }
    }
    
    // Create badge to ID mapping
    const badgeToId = Object.fromEntries(
      insertedEmployees.map(emp => [emp.badge, emp.id])
    );
    
    // Insert overtime entries (check for duplicates by employee_id and occurred_at)
    console.log('⏰ Seeding overtime entries...');
    for (const entry of sampleOvertimeEntries) {
      const employeeId = badgeToId[entry.badge];
      if (!employeeId) {
        console.log(`  ⚠️  Employee with badge ${entry.badge} not found, skipping entry`);
        continue;
      }
      
      const existing = await db
        .select()
        .from(overtimeEntries)
        .where(eq(overtimeEntries.employee_id, employeeId))
        .limit(1);
      
      // Only insert if no overtime entries exist for this employee (keep it simple)
      const hasExistingEntries = existing.some(e => 
        e.employee_id === employeeId && 
        Math.abs(e.occurred_at.getTime() - entry.occurred_at.getTime()) < 60000 // within 1 minute
      );
      
      if (!hasExistingEntries) {
        await db.insert(overtimeEntries).values({
          employee_id: employeeId,
          hours: entry.hours,
          occurred_at: entry.occurred_at,
          source: entry.source,
          note: entry.note,
        });
        console.log(`  ✅ Created overtime entry: ${entry.hours}h for badge ${entry.badge}`);
      } else {
        console.log(`  ♻️  Overtime entry exists for badge ${entry.badge} at ${entry.occurred_at}`);
      }
    }
    
    // Insert/update config (upsert)
    console.log('⚙️  Seeding configuration...');
    const existingConfig = await db.select().from(config).limit(1);
    
    if (existingConfig.length === 0) {
      await db.insert(config).values({
        default_refusal_hours: '8.0',
      });
      console.log('  ✅ Created default configuration');
    } else {
      console.log('  ♻️  Configuration already exists');
    }
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the seed function
seed();