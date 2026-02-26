// Test fixture: sql<number> with aggregate functions (type assertion bug)
// Databases return aggregate results as strings, so sql<number> with
// COUNT/SUM/AVG/MIN/MAX silently returns "123" instead of 123.

import { db } from '~/db';
import { orders } from '~/db/schema';
import { sql } from 'drizzle-orm';

export async function loader() {
  // BAD: sql<number> with COUNT -- database returns string
  const withCount = await db
    .select({
      userId: orders.userId,
      orderCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(orders)
    .groupBy(orders.userId);

  // BAD: sql<number> with SUM
  const withSum = await db
    .select({
      userId: orders.userId,
      totalSpent: sql<number>`SUM(${orders.total})`,
    })
    .from(orders)
    .groupBy(orders.userId);

  // BAD: sql<number> with AVG
  const withAvg = await db
    .select({
      avgTotal: sql<number>`AVG(${orders.total})`,
    })
    .from(orders);

  // BAD: sql<number | null> with MIN (union type containing number)
  const withMin = await db
    .select({
      minTotal: sql<number | null>`MIN(${orders.total})`,
    })
    .from(orders);

  // BAD: sql<number> with MAX in db.execute
  const withMax = await db.execute(
    sql<number>`SELECT MAX(${orders.total}) FROM orders`
  );

  // GOOD: sql<string> with COUNT -- developer knows it returns string
  const countAsString = await db
    .select({
      orderCount: sql<string>`COUNT(${orders.id})`,
    })
    .from(orders)
    .groupBy(orders.userId);

  // GOOD: sql<number> without aggregate -- simple arithmetic, no issue
  const withLiteral = await db
    .select({
      doubled: sql<number>`${orders.total} * 2`,
    })
    .from(orders);

  // GOOD: sql<string | null> with aggregate -- developer handles it
  const sumAsString = await db
    .select({
      total: sql<string | null>`SUM(${orders.total})`,
    })
    .from(orders)
    .groupBy(orders.userId);

  // GOOD: sql without type parameter (no assertion to check)
  const rawCount = await db.execute(sql`SELECT COUNT(*) FROM orders`);

  return {
    withCount,
    withSum,
    withAvg,
    withMin,
    withMax,
    countAsString,
    withLiteral,
    sumAsString,
    rawCount,
  };
}

export default function AggregateTypes() {
  return (
    <div>
      <h1>Aggregate Types</h1>
    </div>
  );
}
