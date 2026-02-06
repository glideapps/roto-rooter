import { useLoaderData } from 'react-router';

// This file tests hydration error deduplication scenarios

export function loader() {
  return {
    date: new Date().toISOString(),
  };
}

export default function HydrationDedup() {
  const data = useLoaderData();

  // Case 1: locale-format error on toLocaleDateString()
  // new Date(data.date) is deterministic (has args), so only locale-format is reported
  const formatted1 = new Date(data.date).toLocaleDateString();

  // Case 2: Only the inner no-arg new Date() is flagged
  // new Date(data.date) and new Date(...setHours...) have args and are not flagged
  const isToday =
    new Date(data.date) >= new Date(new Date().setHours(0, 0, 0, 0));

  // Case 3: Separate date-render errors on different lines
  // Should report 2 separate errors (not deduplicated)
  const date1 = new Date();
  const date2 = new Date();

  // Case 4: Multiple locale-format on same Date variable
  // Should report 3 errors (no deduplication since they're separate calls)
  const now = new Date();
  const localeDate = now.toLocaleDateString();
  const localeTime = now.toLocaleTimeString();
  const localeStr = now.toLocaleString();

  return (
    <div>
      <h1>Deduplication Test</h1>
      <p>Formatted: {formatted1}</p>
      <p>Is Today: {isToday ? 'yes' : 'no'}</p>
      <p>Date1: {date1.toISOString()}</p>
      <p>Date2: {date2.toISOString()}</p>
      <p>Locale Date: {localeDate}</p>
      <p>Locale Time: {localeTime}</p>
      <p>Locale Str: {localeStr}</p>
    </div>
  );
}
