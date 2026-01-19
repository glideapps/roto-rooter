// Test fixture: Type mismatch - string to integer
// This should trigger: Column 'age' expects integer but receives string from formData.get()

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');
  const email = formData.get('email');
  const status = 'active'; // Using literal to avoid enum error

  // age comes from formData.get() which returns string, but column expects integer!
  const age = formData.get('age');

  await db.insert(users).values({
    name,
    email,
    status,
    age, // string passed to integer column!
  });

  return { success: true };
}

export default function UserTypeMismatch() {
  return (
    <form method="post">
      <input name="name" />
      <input name="email" type="email" />
      <input name="age" type="number" />
      <button type="submit">Create</button>
    </form>
  );
}
