// Test fixture: Update setting a notNull column to null
// This should trigger: Column 'name' has notNull constraint but receives null

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';
import { eq } from 'drizzle-orm';

export async function action({ params }: ActionFunctionArgs) {
  await db
    .update(users)
    .set({
      name: null,
    })
    .where(eq(users.id, Number(params.id)));

  return { success: true };
}

export default function UpdateNullNotNull() {
  return (
    <form method="post">
      <button type="submit">Clear Name</button>
    </form>
  );
}
