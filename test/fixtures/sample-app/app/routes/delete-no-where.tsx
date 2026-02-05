// Test fixture: DELETE without WHERE clause
// This should trigger: db.delete(users) has no .where() clause -- affects all rows

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action(_args: ActionFunctionArgs) {
  await db.delete(users);

  return { success: true };
}

export default function DeleteNoWhere() {
  return (
    <form method="post">
      <button type="submit">Delete All Users</button>
    </form>
  );
}
