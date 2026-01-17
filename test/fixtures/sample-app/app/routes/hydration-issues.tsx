import { useLoaderData } from 'react-router';
import { v4 as uuid } from 'uuid';

// This file contains various hydration mismatch issues for testing

export function loader() {
  return {
    createdAt: new Date().toISOString(),
    items: [],
  };
}

export default function HydrationIssues() {
  const data = useLoaderData();

  // Bad: Date created during render
  const now = new Date();
  const timestamp = Date.now();

  // Bad: Locale formatting without timezone
  const formatted = now.toLocaleDateString();
  const timeFormatted = now.toLocaleTimeString();
  const fullFormatted = now.toLocaleString();

  // Bad: Random value in render
  const randomId = Math.random();
  const uniqueId = uuid();

  // Bad: Browser API access in render
  const width = window.innerWidth;
  const savedData = localStorage.getItem('key');

  return (
    <div>
      <h1>Hydration Issues Demo</h1>
      <p>Current time: {now.toISOString()}</p>
      <p>Timestamp: {timestamp}</p>
      <p>Formatted: {formatted}</p>
      <p>Time: {timeFormatted}</p>
      <p>Full: {fullFormatted}</p>
      <p>Random: {randomId}</p>
      <p>UUID: {uniqueId}</p>
      <p>Width: {width}</p>
      <p>Saved: {savedData}</p>
    </div>
  );
}
