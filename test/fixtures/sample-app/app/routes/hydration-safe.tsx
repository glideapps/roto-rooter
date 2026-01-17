import { useEffect, useState } from 'react';
import { useLoaderData } from 'react-router';

// This file demonstrates safe patterns that should NOT trigger warnings

export function loader() {
  return {
    createdAt: new Date().toISOString(),
    items: [],
  };
}

export default function HydrationSafe() {
  const data = useLoaderData();
  const [clientTime, setClientTime] = useState<string | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  // Good: Date operations in useEffect
  useEffect(() => {
    const now = new Date();
    setClientTime(now.toLocaleString());

    // Good: Browser API in useEffect
    setWidth(window.innerWidth);
  }, []);

  // Good: Locale formatting with explicit timezone
  const safeFormatted = new Date().toLocaleDateString('en-US', {
    timeZone: 'UTC',
  });

  return (
    <div>
      <h1>Hydration Safe Demo</h1>

      {/* Good: suppressHydrationWarning */}
      <time suppressHydrationWarning>{new Date().toISOString()}</time>

      {/* Good: Client-only rendering */}
      {clientTime && <p>Client time: {clientTime}</p>}
      {width && <p>Width: {width}</p>}

      {/* Good: Safe formatted date */}
      <p>UTC Date: {safeFormatted}</p>
    </div>
  );
}
