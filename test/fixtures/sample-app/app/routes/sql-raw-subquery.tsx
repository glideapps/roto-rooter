// Test fixture: Raw SQL tagged template literals in Drizzle queries
// This file demonstrates sql`...` patterns that should be extracted

import { LoaderFunctionArgs } from 'react-router';
import { db } from '~/db';
import { employees, employeeImages, images, users, orders } from '~/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function loader({ params }: LoaderFunctionArgs) {
  // 1. Computed column subquery inside .select({})
  //    The most common pattern: sql`` as a virtual column alongside real columns
  const allEmployees = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      email: employees.email,
      department: employees.department,
      profilePhoto: sql<string | null>`
        (SELECT ${images.url}
         FROM employee_images
         JOIN images ON ${images.id} = ${employeeImages.imageId}
         WHERE ${employeeImages.employeeId} = ${employees.id}
         AND ${employeeImages.isPrimary} = true
         LIMIT 1)
      `,
    })
    .from(employees)
    .where(eq(employees.isDeleted, false))
    .orderBy(desc(employees.createdAt));

  // 2. sql`` in a WHERE clause via db.select().from().where(sql`...`)
  //    Used for complex conditions that Drizzle operators can't express
  const recentUsers = await db
    .select()
    .from(users)
    .where(sql`${users.createdAt} > NOW() - INTERVAL '30 days'`);

  // 3. Pure raw SQL with no interpolations
  //    Sometimes used for simple expressions or database functions
  const withTimestamp = await db
    .select({
      id: users.id,
      name: users.name,
      currentTime: sql<string>`NOW()`,
    })
    .from(users);

  // 4. sql`` with a dynamic parameter (not a column ref)
  //    e.g. a route param or variable interpolated into raw SQL
  const userId = Number(params.id);
  const userOrders = await db
    .select()
    .from(orders)
    .where(
      sql`${orders.userId} = ${userId} AND ${orders.status} != 'cancelled'`
    );

  // 5. Standalone sql`` query via db.execute(sql`...`)
  //    Full raw query, not part of a method chain select/insert/update/delete
  const stats = await db.execute(
    sql`SELECT COUNT(*) as total, ${employees.department} as dept FROM employees GROUP BY ${employees.department}`
  );

  return {
    employees: allEmployees,
    recentUsers,
    withTimestamp,
    userOrders,
    stats,
  };
}

export default function EmployeeList() {
  return (
    <div>
      <h1>Employees</h1>
    </div>
  );
}
