// Test fixture: Insert with a column that doesn't exist on the table
// This should trigger: Column 'middleName' not found on table 'users'

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');
  const email = formData.get('email');
  const middleName = formData.get('middleName');

  await db.insert(users).values({
    name,
    email,
    middleName,
    status: 'active',
  });

  return { success: true };
}

export default function UnknownColumn() {
  return (
    <form method="post">
      <input name="name" />
      <input name="email" />
      <input name="middleName" />
      <button type="submit">Create</button>
    </form>
  );
}
