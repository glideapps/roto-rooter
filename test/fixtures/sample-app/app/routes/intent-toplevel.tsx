import { Form, redirect } from 'react-router';

// Test fixture for intent-based dispatch where fields are read at the top level
// but only used within specific intent branches.
// This pattern should NOT cause false positives for forms with different intents.

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // Fields read at TOP LEVEL (outside intent conditionals)
  const firstName = formData.get('firstName');
  const lastName = formData.get('lastName');
  const email = formData.get('email');

  if (intent === 'edit') {
    // Use the fields read at top level
    console.log('Editing:', firstName, lastName, email);
    return redirect('/');
  }

  if (intent === 'delete') {
    // DELETE doesn't need firstName/lastName/email
    console.log('Deleting');
    return redirect('/');
  }

  if (intent === 'archive') {
    // Archive also doesn't need the name fields
    console.log('Archiving');
    return redirect('/');
  }

  return null;
}

export default function IntentTopLevelPage() {
  return (
    <div>
      {/* Edit form - needs firstName, lastName, email */}
      <Form method="post">
        <input name="firstName" />
        <input name="lastName" />
        <input name="email" />
        <button type="submit" name="intent" value="edit">
          Save
        </button>
      </Form>

      {/* Delete form - should NOT require firstName, lastName, email */}
      <Form method="post">
        <input type="hidden" name="id" value="123" />
        <button type="submit" name="intent" value="delete">
          Delete
        </button>
      </Form>

      {/* Archive form - should NOT require firstName, lastName, email */}
      <Form method="post">
        <input type="hidden" name="id" value="456" />
        <button type="submit" name="intent" value="archive">
          Archive
        </button>
      </Form>
    </div>
  );
}
