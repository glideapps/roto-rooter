// Test fixture: UPDATE without WHERE clause
// This should trigger: db.update(users) has no .where() clause -- affects all rows

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');

  await db.update(users).set({
    name,
  });

  return { success: true };
}

export default function UpdateNoWhere() {
  return (
    <form method="post">
      <input name="name" />
      <button type="submit">Update All Users</button>
    </form>
  );
}
