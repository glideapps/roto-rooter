# roto-rooter

Static analysis and functional verifier tool for React Router applications.

## Installation

```bash
npm install -g roto-rooter
```

## Usage

```bash
# Check all files
rr

# Check specific file(s)
rr app/routes/employees.tsx

# Run specific checks only
rr --check links,forms

# Output as JSON
rr --format json

# Set app directory
rr --app ./my-app
```

## Checks

- **links**: Validates Link, redirect(), and navigate() targets exist as defined routes
- **forms**: Validates forms submit to routes with action exports, and that form fields match what the action reads via formData.get()
- **loader**: Validates useLoaderData() is only used in routes with loaders
- **params**: Validates useParams() accesses only params defined in the route
- **hydration**: Detects SSR hydration mismatch risks (dates, locale formatting, random values, browser APIs)

## Programmatic API

```typescript
import { analyze } from 'roto-rooter';

const result = analyze({
  root: './my-app',
  files: [], // empty = all files
  checks: [], // empty = all checks
  format: 'text',
});

console.log(result.issues);
```

## Development

```bash
npm install      # Install dependencies
npm test         # Run tests
npm run build    # Build for distribution
```
