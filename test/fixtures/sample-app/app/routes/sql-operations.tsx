// Test fixture: Various SQL operations for extraction testing
// This file demonstrates different Drizzle query patterns that should be extracted

import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, useFetcher } from 'react-router';
import { db } from '~/db';
import { users, orders } from '~/db/schema';
import { eq, gt, like, and, desc, isNull } from 'drizzle-orm';

// Loader with SELECT query
export async function loader({ params }: LoaderFunctionArgs) {
  // Simple select all
  const allUsers = await db.select().from(users);

  // Select specific columns
  await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users);

  // Select single column
  await db.select({ id: users.id }).from(users);

  // Select with where clause
  const activeUsers = await db
    .select()
    .from(users)
    .where(eq(users.status, 'active'));

  // Select with multiple conditions
  await db
    .select()
    .from(users)
    .where(and(eq(users.status, 'active'), gt(users.age, 18)));

  // Select with order by
  await db.select().from(users).orderBy(desc(users.createdAt));

  // Select with limit and offset
  await db.select().from(users).limit(10).offset(20);

  // Select specific user by id
  const userId = Number(params.id);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Select with like pattern
  await db.select().from(users).where(like(users.name, '%john%'));

  // Select with null check
  await db.select().from(users).where(isNull(users.bio));

  return { allUsers, activeUsers, user };
}

// Action with INSERT, UPDATE, DELETE
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create-user') {
    // Simple insert
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const status = 'pending';

    await db.insert(users).values({
      name,
      email,
      status,
    });

    return { success: true, action: 'created' };
  }

  if (intent === 'create-order') {
    // Insert with type conversions
    const userId = Number(formData.get('userId'));
    const total = Number(formData.get('total'));
    const notes = formData.get('notes') as string;

    await db.insert(orders).values({
      userId,
      total,
      status: 'active',
      notes,
    });

    return { success: true, action: 'order-created' };
  }

  if (intent === 'update-user') {
    // Update with where clause
    const id = Number(formData.get('id'));
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;

    await db
      .update(users)
      .set({
        name,
        email,
      })
      .where(eq(users.id, id));

    return { success: true, action: 'updated' };
  }

  if (intent === 'update-status') {
    // Update with literal value
    const id = Number(formData.get('id'));

    await db
      .update(users)
      .set({
        status: 'closed',
        isActive: false,
      })
      .where(eq(users.id, id));

    return { success: true, action: 'status-updated' };
  }

  if (intent === 'delete-user') {
    // Delete with where clause
    const id = Number(formData.get('id'));

    await db.delete(users).where(eq(users.id, id));

    return { success: true, action: 'deleted' };
  }

  if (intent === 'delete-inactive') {
    // Delete with complex condition
    await db
      .delete(users)
      .where(and(eq(users.status, 'closed'), eq(users.isActive, false)));

    return { success: true, action: 'bulk-deleted' };
  }

  // Inline delete button pattern - deletes a specific order
  if (intent === 'delete-order') {
    const orderId = Number(formData.get('orderId'));
    await db.delete(orders).where(eq(orders.id, orderId));
    return { success: true, action: 'order-deleted' };
  }

  // Archive pattern - soft delete by updating status
  if (intent === 'archive-user') {
    const id = Number(formData.get('id'));
    await db
      .update(users)
      .set({
        status: 'archived',
        isActive: false,
        archivedAt: new Date(),
      })
      .where(eq(users.id, id));
    return { success: true, action: 'archived' };
  }

  // Batch update pattern - mark multiple items as complete
  if (intent === 'complete-orders') {
    const orderIds = formData.getAll('orderIds').map(Number);
    // This would be a batch update in real code
    for (const orderId of orderIds) {
      await db
        .update(orders)
        .set({ status: 'completed' })
        .where(eq(orders.id, orderId));
    }
    return { success: true, action: 'orders-completed' };
  }

  return { error: 'Unknown intent' };
}

export default function SqlOperations() {
  return (
    <div>
      <h1>SQL Operations Test</h1>

      {/* Standard form submission - CREATE */}
      <form method="post">
        <input type="hidden" name="intent" value="create-user" />
        <input name="name" placeholder="Name" />
        <input name="email" placeholder="Email" />
        <button type="submit">Create User</button>
      </form>

      {/* Form with type conversions - CREATE */}
      <form method="post">
        <input type="hidden" name="intent" value="create-order" />
        <input name="userId" type="number" placeholder="User ID" />
        <input name="total" type="number" placeholder="Total" />
        <input name="notes" placeholder="Notes" />
        <button type="submit">Create Order</button>
      </form>

      {/* Standard form submission - UPDATE */}
      <form method="post">
        <input type="hidden" name="intent" value="update-user" />
        <input name="id" type="number" placeholder="User ID" />
        <input name="name" placeholder="Name" />
        <input name="email" placeholder="Email" />
        <button type="submit">Update User</button>
      </form>

      {/* Standard form submission - DELETE */}
      <form method="post">
        <input type="hidden" name="intent" value="delete-user" />
        <input name="id" type="number" placeholder="User ID" />
        <button type="submit">Delete User</button>
      </form>

      {/* Inline delete button on list items - common pattern for destructive actions */}
      <OrderList />

      {/* Archive button - soft delete pattern */}
      <UserArchiveButton userId={123} />

      {/* Batch operations with checkboxes */}
      <BatchCompleteForm />

      {/* useFetcher for programmatic submissions */}
      <QuickAddUser />
    </div>
  );
}

// Inline delete button pattern - appears on each row of a list
function OrderList() {
  const orders = [
    { id: 1, total: 100 },
    { id: 2, total: 200 },
  ];

  return (
    <ul>
      {orders.map((order) => (
        <li key={order.id}>
          Order #{order.id} - ${order.total}
          {/* Inline delete form - button directly deletes the item */}
          <Form method="post">
            <input type="hidden" name="intent" value="delete-order" />
            <input type="hidden" name="orderId" value={order.id} />
            <button type="submit" aria-label="Delete order">
              X
            </button>
          </Form>
        </li>
      ))}
    </ul>
  );
}

// Archive button - soft delete pattern
function UserArchiveButton({ userId }: { userId: number }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="archive-user" />
      <input type="hidden" name="id" value={userId} />
      <button type="submit">Archive User</button>
    </Form>
  );
}

// Batch operations with checkboxes
function BatchCompleteForm() {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="complete-orders" />
      <label>
        <input type="checkbox" name="orderIds" value="1" />
        Order 1
      </label>
      <label>
        <input type="checkbox" name="orderIds" value="2" />
        Order 2
      </label>
      <label>
        <input type="checkbox" name="orderIds" value="3" />
        Order 3
      </label>
      <button type="submit">Complete Selected</button>
    </Form>
  );
}

// useFetcher pattern - programmatic form submission
function QuickAddUser() {
  const fetcher = useFetcher();

  const handleQuickAdd = () => {
    fetcher.submit(
      {
        intent: 'create-user',
        name: 'Quick User',
        email: 'quick@example.com',
      },
      { method: 'post' }
    );
  };

  return (
    <div>
      <button onClick={handleQuickAdd}>Quick Add User</button>
      {fetcher.state === 'submitting' && <span>Adding...</span>}
    </div>
  );
}
