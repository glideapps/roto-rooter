import { redirect } from 'react-router';

// This file tests that Date operations in loader/action are NOT flagged
// because they run server-side only

export function loader() {
  // These Date operations happen on the server, not during hydration
  const now = new Date();
  const timestamp = Date.now();
  const formatted = now.toLocaleDateString();

  return {
    serverTime: now.toISOString(),
    timestamp,
    formatted,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create') {
    // These Date operations happen on the server, not during hydration
    const createdAt = new Date();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    console.log(createdAt, expiresAt);
    return redirect('/');
  }

  if (intent === 'delete') {
    const deletedAt = new Date();
    console.log(deletedAt);
    return redirect('/');
  }

  return null;
}

export default function ServerDatesPage() {
  // Note: This file has no client-side Date operations
  // All Date operations are in loader/action
  return (
    <div>
      <h1>Server Dates Demo</h1>
      <p>This page has Date operations only in loader/action functions.</p>
    </div>
  );
}
