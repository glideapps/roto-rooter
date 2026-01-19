// Test fixture: Enum from formData without validation
// This should trigger: Enum column 'status' receives unvalidated external input

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { orders } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  // Status comes from formData without validation - enum column!
  const status = formData.get('status');
  const userId = Number(formData.get('userId'));
  const total = Number(formData.get('total'));

  await db.insert(orders).values({
    status, // This is unvalidated external input to an enum column!
    userId,
    total,
  });

  return { success: true };
}

export default function OrderCreate() {
  return (
    <form method="post">
      <input name="userId" type="hidden" value="1" />
      <select name="status">
        <option value="active">Active</option>
        <option value="pending">Pending</option>
      </select>
      <input name="total" type="number" />
      <button type="submit">Create Order</button>
    </form>
  );
}
