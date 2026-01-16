import { Link } from "react-router";

export function loader() {
  return { message: "Welcome" };
}

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Link to="/employees">View Employees</Link>
      <Link to="/employeees">Bad Link Typo</Link>
      <a href="/tasks">View Tasks</a>
    </div>
  );
}
