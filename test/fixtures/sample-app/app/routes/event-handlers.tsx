// Test fixture for event handler false positive fix
// Event handlers should NOT be flagged for hydration issues since they don't run during render

interface Employee {
  phone: string | null;
  email: string;
}

export default function EventHandlerTestComponent() {
  // This is fine - data comes from outside, no Date construction during render
  const employee: Employee = {
    phone: '555-1234',
    email: 'test@example.com',
  };

  // SAFE: Event handlers with window.location
  // These only run on user click - never during render/SSR
  const handleCall = () => {
    if (employee.phone) {
      window.location.href = `tel:${employee.phone.replace(/\D/g, '')}`;
    }
  };

  const handleText = () => {
    if (employee.phone) {
      window.location.href = `sms:${employee.phone.replace(/\D/g, '')}`;
    }
  };

  const handleEmail = () => {
    window.location.href = `mailto:${employee.email}`;
  };

  // SAFE: Event handler with document API
  const handleShare = () => {
    const link = document.createElement('a');
    link.href = `mailto:${employee.email}`;
    link.click();
  };

  // SAFE: Event handler with typeof window guard
  const handleCallWithGuard = () => {
    if (employee.phone && typeof window !== 'undefined') {
      window.location.href = `tel:${employee.phone}`;
    }
  };

  // SAFE: Inline event handler
  const handleInline = () => {
    if (typeof document !== 'undefined') {
      document.title = 'Clicked!';
    }
  };

  return (
    <div>
      <h1>Event Handler Test</h1>

      {/* These event handlers should NOT be flagged */}
      <button onClick={handleCall}>Call</button>
      <button onClick={handleText}>Text</button>
      <button onClick={handleEmail}>Email</button>
      <button onClick={handleShare}>Share</button>
      <button onClick={handleCallWithGuard}>Call (guarded)</button>
      <button onClick={handleInline}>Inline</button>

      {/* Inline arrow function in onClick - also should NOT be flagged */}
      <button
        onClick={() => {
          window.location.href = '/home';
        }}
      >
        Home
      </button>
    </div>
  );
}
