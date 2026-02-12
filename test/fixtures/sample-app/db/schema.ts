import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  timestamp,
  date,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

// Enum definition
export const statusEnum = pgEnum('status', ['active', 'pending', 'closed']);

// Users table with various column types
export const users = pgTable('users', {
  id: serial('id').primaryKey(), // auto-generated, not required
  name: text('name').notNull(), // REQUIRED
  email: text('email').notNull(), // REQUIRED
  bio: text('bio'), // optional
  status: statusEnum('status').notNull(), // REQUIRED ENUM
  age: integer('age'), // optional integer
  isActive: boolean('is_active'), // optional boolean
  createdAt: timestamp('created_at').defaultNow(), // has default, not required
});

// Orders table for additional testing
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(), // REQUIRED integer
  status: statusEnum('status').notNull(), // REQUIRED ENUM
  total: integer('total').notNull(), // REQUIRED integer
  notes: text('notes'), // optional
  createdAt: timestamp('created_at').defaultNow(),
});

// Events table for timestamp/date/json testing
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  startDate: date('start_date').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  metadata: jsonb('metadata'),
});

// Employees table for raw SQL subquery testing
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  department: text('department'),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Images table
export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
});

// Join table for employee profile photos
export const employeeImages = pgTable('employee_images', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  imageId: integer('image_id').notNull(),
  isPrimary: boolean('is_primary').default(false),
});
