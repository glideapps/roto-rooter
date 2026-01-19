import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  timestamp,
  boolean,
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
