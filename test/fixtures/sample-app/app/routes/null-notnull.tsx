// Test fixture: Null literal assigned to a notNull column
// This should trigger: Column 'name' has notNull constraint but receives null

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action(_args: ActionFunctionArgs) {
  await db.insert(users).values({
    name: null,
    email: 'test@example.com',
    status: 'active',
  });

  return { success: true };
}

export default function NullNotNull() {
  return (
    <form method="post">
      <button type="submit">Create</button>
    </form>
  );
}
