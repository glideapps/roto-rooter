// Test fixture: Import aliases for table names
// import { users as usersTable } should resolve to the 'users' table in schema

import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { db } from '~/db';
import { users as usersTable } from '~/db/schema';
import { eq } from 'drizzle-orm';

export async function loader({ params }: LoaderFunctionArgs) {
  // SELECT with aliased table name - should resolve to 'users'
  const allUsers = await db.select().from(usersTable);

  // SELECT specific columns with aliased table
  const userNames = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable);

  // SELECT with where using aliased table
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, Number(params.id)))
    .limit(1);

  return { allUsers, userNames, user };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const name = formData.get('name');
  const email = formData.get('email');
  const status = formData.get('status');

  // Uses aliased table name - should still resolve to 'users'
  await db.insert(usersTable).values({
    name,
    email,
    status,
  });

  return { success: true };
}

export default function ImportAlias() {
  return (
    <form method="post">
      <input name="name" />
      <input name="email" />
      <select name="status">
        <option value="active">Active</option>
      </select>
      <button type="submit">Create</button>
    </form>
  );
}
