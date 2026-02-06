import { useLoaderData } from 'react-router';

// Good: clientLoader that only uses browser APIs
export async function clientLoader() {
  const cached = localStorage.getItem('settings');
  return cached ? JSON.parse(cached) : {};
}

export default function Settings() {
  const data = useLoaderData<typeof clientLoader>();

  return (
    <div>
      <h1>Settings</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
