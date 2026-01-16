import { Link, useLoaderData } from "react-router";

export function loader() {
  return { employees: [] };
}

export default function Employees() {
  const data = useLoaderData();

  return (
    <div>
      <h1>Employees</h1>
      {data.employees.map((emp: any) => (
        <Link key={emp.id} to={`/employees/${emp.id}`}>
          {emp.name}
        </Link>
      ))}
    </div>
  );
}
