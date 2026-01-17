import { useLoaderData, Form } from 'react-router';

// No loader export - but useLoaderData is called (error)

export default function Tasks() {
  const data = useLoaderData(); // Error: no loader

  return (
    <div>
      <h1>Tasks</h1>
      <Form method="post">
        <input name="task" />
        <button type="submit">Add Task</button>
      </Form>
    </div>
  );
}
