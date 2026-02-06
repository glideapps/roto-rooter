import { Form, redirect } from 'react-router';

// Test fixture for intent-based dispatch where the intent variable
// uses a type cast: formData.get('intent') as string
// This pattern is common in real apps and should not cause false positives.

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'update') {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    console.log('Updating:', name, email, phone);
    return redirect('/');
  }

  if (intent === 'delete') {
    // Delete doesn't read any additional fields
    console.log('Deleting');
    return redirect('/');
  }

  if (intent === 'archive') {
    const reason = formData.get('reason') as string;
    console.log('Archiving:', reason);
    return redirect('/');
  }

  return null;
}

export default function IntentTypeCastPage() {
  return (
    <div>
      {/* Update form - needs name, email, phone */}
      <Form method="post">
        <input name="name" />
        <input name="email" />
        <input name="phone" />
        <button type="submit" name="intent" value="update">
          Update
        </button>
      </Form>

      {/* Delete form - should NOT require name, email, phone */}
      <Form method="post">
        <button type="submit" name="intent" value="delete">
          Delete
        </button>
      </Form>

      {/* Archive form - only needs reason */}
      <Form method="post">
        <input name="reason" />
        <button type="submit" name="intent" value="archive">
          Archive
        </button>
      </Form>
    </div>
  );
}
