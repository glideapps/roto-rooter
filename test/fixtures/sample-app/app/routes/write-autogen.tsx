// Test fixture: Explicitly setting auto-generated column (serial id)
// This should trigger: Column 'id' is auto-generated (serial) but is explicitly set in insert

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');
  const email = formData.get('email');

  await db.insert(users).values({
    id: 42,
    name,
    email,
    status: 'active',
  });

  return { success: true };
}

export default function WriteAutogen() {
  return (
    <form method="post">
      <input name="name" />
      <input name="email" />
      <button type="submit">Create</button>
    </form>
  );
}
