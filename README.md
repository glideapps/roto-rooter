# roto-rooter

A static analysis tool for [React Router](https://reactrouter.com/) apps. It catches common bugs -- broken links, missing loaders, hydration mismatches, disconnected UI elements, and incorrect database operations -- by reading your route definitions and cross-referencing them against your components.

```
npm install -g roto-rooter
```

## Running Checks

```
rr [OPTIONS] [FILES...]
```

Point `rr` at your project and it scans your route files for issues. With no arguments it runs the **default checks** (links, loader, params, interactivity) against all files in the current directory.

| Option                    | Description                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-c, --check <checks>`    | Comma-separated checks to run. Use `defaults` for the default set, `all` for everything, or pick individual checks: `links`, `loader`, `params`, `interactivity`, `forms`, `hydration`, `drizzle` |
| `-f, --format <format>`   | Output format: `text` (default) or `json`                                                                                                                                                         |
| `-r, --root <path>`       | Project root containing the `app/` folder (default: cwd)                                                                                                                                          |
| `--fix`                   | Auto-fix issues where possible                                                                                                                                                                    |
| `--dry-run`               | Preview fixes without writing files                                                                                                                                                               |
| `--drizzle-schema <path>` | Path to Drizzle schema file (auto-discovered by default)                                                                                                                                          |

**Checks at a glance:**

- **links** (default) -- validates `<Link>`, `redirect()`, `navigate()`, and `href` props on any component exist as routes
- **loader** (default) -- ensures `useLoaderData()` is backed by a loader; catches `clientLoader` importing server-only modules
- **params** (default) -- ensures `useParams()` only accesses params defined in the route path
- **interactivity** (default) -- catches "Save" buttons that don't save, "Delete" buttons that don't delete, and empty click handlers
- **forms** (opt-in) -- validates `<Form>` targets have actions and that field names match `formData.get()` calls
- **hydration** (opt-in) -- detects SSR/client mismatches from `new Date()`, `Math.random()`, `window` access in render
- **drizzle** (opt-in) -- validates Drizzle ORM operations against your schema (missing columns, type mismatches, etc.)

**Example output:**

```
$ rr --root my-app

rr found 5 issues:

[error] dashboard.tsx:12:7
  href="/employeees"
  x No matching route
  -> Did you mean: /employees?

[error] tasks.tsx:6:16
  useLoaderData()
  x useLoaderData() called but route has no loader
  -> Add a loader function or remove the hook

[error] employees.$id.edit.tsx:7:32
  useParams().invalidParam
  x useParams() accesses "invalidParam" but route has no :invalidParam parameter
  -> Available params: :id

[error] disconnected-dialog.tsx:27:11
  <Button onClick={...}>Save Changes</Button>
  x "Save Changes" button in Dialog only closes dialog without saving data
  -> Wrap inputs in a <Form> component or use useFetcher.submit() to persist data

[warning] disconnected-dialog.tsx:78:11
  <Button onClick={...}>Add Item</Button>
  x "Add Item" button has an empty or stub onClick handler
  -> Implement the handler or remove the button if not needed

Summary: 4 errors, 1 warning
Run with --help for options.
```

## Extracting SQL

```
rr sql --drizzle [OPTIONS] [FILES...]
```

Reads your Drizzle ORM code and prints the equivalent SQL for every query it finds. Useful for reviewing what your app actually sends to the database.

| Option                    | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `--drizzle`               | Required. Specifies the ORM to analyze.                  |
| `-f, --format <format>`   | Output format: `text` (default) or `json`                |
| `-r, --root <path>`       | Project root directory (default: cwd)                    |
| `--drizzle-schema <path>` | Path to Drizzle schema file (auto-discovered by default) |

**Example output:**

```
$ rr sql --drizzle --root my-app

Found 6 SQL queries:

File: app/routes/users.tsx:13:26
  SELECT * FROM users

File: app/routes/users.tsx:16:9
  SELECT id, name, email FROM users

File: app/routes/users.tsx:24:29
  SELECT * FROM users WHERE status = 'active'

File: app/routes/users.tsx:36:9
  INSERT INTO users (name, email, status) VALUES ($1, $2, $3)
  Parameters:
    $1: name (text)
    $2: email (text)
    $3: status (enum)

File: app/routes/orders.tsx:16:9
  INSERT INTO orders (status, user_id, total) VALUES ($1, $2, $3)
  Parameters:
    $1: status (enum)
    $2: userId (integer)
    $3: total (integer)

File: app/routes/users.tsx:42:9
  DELETE FROM users WHERE id = $1
  Parameters:
    $1: Number(params.id) (serial)
```

## Development

```
npm install      # install dependencies
npm test         # run tests
npm run build    # build for distribution
```
