// Test fixture: Correct patterns (no errors expected)
// All values are properly validated or typed

import { ActionFunctionArgs } from 'react-router';
import { z } from 'zod';
import { db } from '~/db';
import { users } from '~/db/schema';

const updateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  status: z.enum(['active', 'pending', 'closed']),
  age: z.number().optional(),
});

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  // Properly validated via zod schema
  const data = updateUserSchema.parse({
    name: formData.get('name'),
    email: formData.get('email'),
    status: formData.get('status'),
    age: formData.get('age') ? Number(formData.get('age')) : undefined,
  });

  // Using validated data - should not trigger any errors
  await db.insert(users).values({
    name: data.name,
    email: data.email,
    status: data.status,
    age: data.age,
  });

  return { success: true };
}

export default function UserUpdate() {
  return (
    <form method="post">
      <input name="name" />
      <input name="email" type="email" />
      <select name="status">
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="closed">Closed</option>
      </select>
      <input name="age" type="number" />
      <button type="submit">Update</button>
    </form>
  );
}
