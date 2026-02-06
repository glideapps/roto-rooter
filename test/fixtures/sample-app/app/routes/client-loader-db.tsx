import { useLoaderData } from 'react-router';
import { db } from '~/db';
import { boatsTable } from 'drizzle-orm';

// Bad: clientLoader runs in the browser, cannot access database
export async function clientLoader() {
  const boats = await db.select().from(boatsTable);
  return { boats };
}

export default function Boats() {
  const { boats } = useLoaderData<typeof clientLoader>();

  return (
    <div>
      <h1>Boats</h1>
      <p>{boats.length} boats found</p>
    </div>
  );
}
