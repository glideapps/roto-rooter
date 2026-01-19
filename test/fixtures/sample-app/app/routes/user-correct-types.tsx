// Test fixture: Correct type conversions (no errors expected)
// Uses Number() to convert formData strings to integers

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');
  const email = formData.get('email');

  // Proper type conversion - Number() wrapping makes this safe
  const age = Number(formData.get('age'));

  // Using literal for status - correctly typed
  await db.insert(users).values({
    name,
    email,
    status: 'active', // literal value, not from external input
    age, // properly converted to number
  });

  return { success: true };
}

export default function UserCorrectTypes() {
  return (
    <form method="post">
      <input name="name" />
      <input name="email" type="email" />
      <input name="age" type="number" />
      <button type="submit">Create</button>
    </form>
  );
}
