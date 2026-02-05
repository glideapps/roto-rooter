// Test fixture: String from formData passed to timestamp/date column
// This should trigger warnings for string-to-timestamp and string-to-date

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { events } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const title = formData.get('title');
  const startDate = formData.get('startDate');
  const scheduledAt = formData.get('scheduledAt');

  await db.insert(events).values({
    title,
    startDate,
    scheduledAt,
  });

  return { success: true };
}

export default function StringToTimestamp() {
  return (
    <form method="post">
      <input name="title" />
      <input name="startDate" type="date" />
      <input name="scheduledAt" type="datetime-local" />
      <button type="submit">Create</button>
    </form>
  );
}
