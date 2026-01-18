import { Form, redirect } from 'react-router';

// This file tests intent-based dispatch pattern where different forms
// have different intents and each intent uses different fields

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create') {
    // Create intent needs title, description, category
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    // ... create logic
    console.log(title, description, category);
    return redirect('/');
  }

  if (intent === 'delete') {
    // Delete intent only needs itemId
    const itemId = formData.get('itemId') as string;
    // ... delete logic
    console.log(itemId);
    return redirect('/');
  }

  if (intent === 'complete') {
    // Complete intent only needs taskId
    const taskId = formData.get('taskId') as string;
    // ... complete logic
    console.log(taskId);
    return redirect('/');
  }

  return null;
}

export default function IntentDispatchPage() {
  return (
    <div>
      {/* Form with create intent - should only need create fields */}
      <Form method="post">
        <input name="title" />
        <input name="description" />
        <input name="category" />
        <button type="submit" name="intent" value="create">
          Create
        </button>
      </Form>

      {/* Form with delete intent - only needs itemId */}
      <Form method="post">
        <input type="hidden" name="itemId" value="123" />
        <button type="submit" name="intent" value="delete">
          Delete
        </button>
      </Form>

      {/* Form with complete intent - only needs taskId */}
      <Form method="post">
        <input type="hidden" name="taskId" value="456" />
        <button type="submit" name="intent" value="complete">
          Complete
        </button>
      </Form>
    </div>
  );
}
