import { useParams } from 'react-router';

// This file accesses a param that doesn't exist in the route
// Route would be /employees/:id/edit with only :id param

export default function EmployeeEdit() {
  const { id, invalidParam } = useParams(); // Error: invalidParam doesn't exist

  return (
    <div>
      <h1>Edit Employee {id}</h1>
      <p>Invalid: {invalidParam}</p>
    </div>
  );
}
