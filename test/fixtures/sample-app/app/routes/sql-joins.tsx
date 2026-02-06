// Test fixture: SQL JOIN and GROUP BY patterns for extraction testing
// Demonstrates Drizzle join operations and groupBy that should produce valid SQL

import { LoaderFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users, orders } from '~/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';

export async function loader({ params: _params }: LoaderFunctionArgs) {
  // INNER JOIN with eq
  const userOrders = await db
    .select()
    .from(users)
    .innerJoin(orders, eq(users.id, orders.userId));

  // LEFT JOIN with eq
  const allUsersWithOrders = await db
    .select()
    .from(users)
    .leftJoin(orders, eq(users.id, orders.userId));

  // JOIN with WHERE clause
  const activeUserOrders = await db
    .select()
    .from(users)
    .innerJoin(orders, eq(users.id, orders.userId))
    .where(eq(users.status, 'active'));

  // JOIN with multiple ON conditions using and()
  const matchedOrders = await db
    .select()
    .from(users)
    .innerJoin(
      orders,
      and(eq(users.id, orders.userId), eq(orders.status, users.status))
    );

  // JOIN with named columns
  const orderSummary = await db
    .select({ id: users.id, name: users.name, total: orders.total })
    .from(users)
    .innerJoin(orders, eq(users.id, orders.userId));

  // GROUP BY single column
  const userOrderCounts = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(orders, eq(users.id, orders.userId))
    .groupBy(users.id);

  // GROUP BY multiple columns
  const ordersByStatus = await db
    .select({ id: users.id, status: orders.status })
    .from(users)
    .innerJoin(orders, eq(users.id, orders.userId))
    .groupBy(users.id, orders.status);

  // JOIN with or() ON conditions
  const flexibleMatch = await db
    .select()
    .from(users)
    .innerJoin(
      orders,
      or(eq(users.id, orders.userId), eq(users.name, orders.status))
    );

  // JOIN with and() containing nested or()
  const complexMatch = await db
    .select()
    .from(users)
    .innerJoin(
      orders,
      and(
        eq(users.id, orders.userId),
        or(eq(orders.status, users.status), eq(orders.total, users.id))
      )
    );

  // JOIN with GROUP BY, ORDER BY, and LIMIT
  const topUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(orders, eq(users.id, orders.userId))
    .groupBy(users.id)
    .orderBy(desc(users.name))
    .limit(10);

  return {
    userOrders,
    allUsersWithOrders,
    activeUserOrders,
    matchedOrders,
    orderSummary,
    userOrderCounts,
    ordersByStatus,
    flexibleMatch,
    complexMatch,
    topUsers,
  };
}

export default function SqlJoins() {
  return <div>SQL Joins Test</div>;
}
