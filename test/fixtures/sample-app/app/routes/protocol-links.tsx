// Test fixture for protocol URL handling
// These protocol URLs should NOT be flagged as missing routes

export default function ProtocolLinksPage() {
  const phone = '555-123-4567';
  const email = 'test@example.com';

  return (
    <div>
      <h1>Protocol Links Test</h1>

      {/* Static protocol links - should not be flagged */}
      <a href="tel:5551234567">Call static</a>
      <a href="sms:5551234567">Text static</a>
      <a href="mailto:test@example.com">Email static</a>

      {/* Dynamic protocol links - should not be flagged */}
      <a href={`tel:${phone}`}>Call dynamic</a>
      <a href={`sms:${phone}`}>Text dynamic</a>
      <a href={`mailto:${email}`}>Email dynamic</a>

      {/* Other protocol URLs - should not be flagged */}
      <a href="javascript:void(0)">JS link</a>
      <a href="data:text/plain,Hello">Data URL</a>

      {/* External URLs - should not be flagged */}
      <a href="https://example.com">External</a>
      <a href="http://example.com">External HTTP</a>

      {/* Hash links - should not be flagged */}
      <a href="#section1">Hash link</a>
      <a href="#">Empty hash</a>
    </div>
  );
}
