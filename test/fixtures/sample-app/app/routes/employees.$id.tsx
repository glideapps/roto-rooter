import { useLoaderData, useParams, Form } from 'react-router';

export function loader({ params }: { params: { id: string } }) {
  return { employee: { id: params.id, name: 'John' } };
}

export function action({ request }: { request: Request }) {
  // Handle form submission
  return null;
}

export default function EmployeeDetail() {
  const data = useLoaderData();
  const { id } = useParams();

  return (
    <div>
      <h1>Employee {id}</h1>
      <Form method="post">
        <input name="name" defaultValue={data.employee.name} />
        <button type="submit">Save</button>
      </Form>
    </div>
  );
}
