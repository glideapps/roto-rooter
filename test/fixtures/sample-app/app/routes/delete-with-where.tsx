// Test fixture: DELETE with WHERE clause (safe pattern)
// This should NOT trigger the missing-where warning

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';
import { eq } from 'drizzle-orm';

export async function action({ params }: ActionFunctionArgs) {
  await db.delete(users).where(eq(users.id, Number(params.id)));

  return { success: true };
}

export default function DeleteWithWhere() {
  return (
    <form method="post">
      <button type="submit">Delete User</button>
    </form>
  );
}
