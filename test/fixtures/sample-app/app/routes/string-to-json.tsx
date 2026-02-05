// Test fixture: String from formData passed to jsonb column
// This should trigger: Column 'metadata' expects jsonb but receives string

import { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { events } from '~/db/schema';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const title = formData.get('title');
  const startDate = new Date(formData.get('startDate') as string);
  const scheduledAt = new Date(formData.get('scheduledAt') as string);
  const metadata = formData.get('metadata');

  await db.insert(events).values({
    title,
    startDate,
    scheduledAt,
    metadata,
  });

  return { success: true };
}

export default function StringToJson() {
  return (
    <form method="post">
      <input name="title" />
      <input name="startDate" type="date" />
      <input name="scheduledAt" type="datetime-local" />
      <textarea name="metadata" />
      <button type="submit">Create</button>
    </form>
  );
}
