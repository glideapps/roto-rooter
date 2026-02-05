// Test fixture: Invalid literal value for an enum column
// This should trigger: Enum column 'status' receives invalid value 'archived'

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');
  const email = formData.get('email');

  await db.insert(users).values({
    name,
    email,
    status: 'archived',
  });

  return { success: true };
}

export default function InvalidEnumLiteral() {
  return (
    <form method="post">
      <input name="name" />
      <input name="email" />
      <button type="submit">Create</button>
    </form>
  );
}
