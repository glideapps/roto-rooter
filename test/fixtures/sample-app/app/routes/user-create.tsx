// Test fixture: Insert missing required column
// This should trigger: db.insert(users) missing required column 'email'

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');
  const status = formData.get('status');
  const age = formData.get('age');

  // Missing 'email' which is required!
  await db.insert(users).values({
    name,
    status,
    age,
  });

  return { success: true };
}

export default function UserCreate() {
  return (
    <form method="post">
      <input name="name" />
      <select name="status">
        <option value="active">Active</option>
        <option value="pending">Pending</option>
      </select>
      <input name="age" type="number" />
      <button type="submit">Create</button>
    </form>
  );
}
