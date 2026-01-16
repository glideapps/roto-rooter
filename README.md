# react-router-analyzer

Static analysis tool for React Router 7 applications that catches runtime errors at build time.

## Installation

```bash
npm install react-router-analyzer
```

## Usage

```bash
# Check all files
npx react-router-analyzer

# Check specific file(s)
npx react-router-analyzer app/routes/employees.tsx

# Run specific checks only
npx react-router-analyzer --check links,forms

# Output as JSON
npx react-router-analyzer --format json

# Set root directory
npx react-router-analyzer --root ./my-app
```

## Checks

- **links**: Validates Link, redirect(), and navigate() targets exist as defined routes
- **forms**: Validates forms submit to routes with action exports
- **loader**: Validates useLoaderData() is only used in routes with loaders
- **params**: Validates useParams() accesses only params defined in the route
- **interactive**: Validates interactive elements have handlers (coming soon)
- **a11y**: Accessibility checks requiring cross-element analysis (coming soon)

## Programmatic API

```typescript
import { analyze } from "react-router-analyzer";

const result = analyze({
  root: "./my-app",
  files: [],       // empty = all files
  checks: [],      // empty = all checks
  format: "text",
});

console.log(result.issues);
```
