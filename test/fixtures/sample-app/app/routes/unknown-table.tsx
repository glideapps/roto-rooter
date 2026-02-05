// Test fixture: Insert into a table not in the schema
// This should trigger: Table 'widgets' not found in Drizzle schema

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { widgets } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');

  await db.insert(widgets).values({
    name,
  });

  return { success: true };
}

export default function UnknownTable() {
  return (
    <form method="post">
      <input name="name" />
      <button type="submit">Create</button>
    </form>
  );
}
