// Test fixture: custom components with href props (e.g. Catalyst UI ListItem, Button)
// These should be detected by the link checker just like <a> and <Link>

export function loader() {
  return {
    employees: [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ],
  };
}

function ListItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return <a href={href}>{children}</a>;
}

function Card({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  return href ? <a href={href}>{children}</a> : <div>{children}</div>;
}

export default function ComponentLinks() {
  const employees = [{ id: '1', name: 'Alice' }];

  return (
    <div>
      {/* Valid: static href to existing route */}
      <ListItem href="/employees">All Employees</ListItem>

      {/* Valid: dynamic href to existing route */}
      {employees.map((emp) => (
        <ListItem key={emp.id} href={`/employees/${emp.id}`}>
          {emp.name}
        </ListItem>
      ))}

      {/* Invalid: href to non-existent route */}
      <ListItem href="/walks">Walks</ListItem>

      {/* Invalid: dynamic href to non-existent route */}
      {employees.map((emp) => (
        <Card key={emp.id} href={`/walks/${emp.id}`}>
          {emp.name}
        </Card>
      ))}
    </div>
  );
}
