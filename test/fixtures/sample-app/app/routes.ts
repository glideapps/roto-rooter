import { type RouteConfig, layout, route } from '@react-router/dev/routes';

export default [
  layout('routes/_layout.tsx', [
    route('/', 'routes/dashboard.tsx', { id: 'home' }),
    route('/employees', 'routes/employees.tsx'),
    route('/employees/:id', 'routes/employees.$id.tsx'),
    route('/employees/:id/edit', 'routes/employees.$id.edit.tsx'),
    route('/tasks', 'routes/tasks.tsx'),
    route('/contact', 'routes/contact.tsx'),
    route('/feedback', 'routes/feedback.tsx'),
    route('/intent-dispatch', 'routes/intent-dispatch.tsx'),
    route('/query-links', 'routes/query-links.tsx'),
    route('/server-dates', 'routes/server-dates.tsx'),
    route('/hydration-dedup', 'routes/hydration-dedup.tsx'),
    route('/component-inputs', 'routes/component-inputs.tsx'),
    // Persistence check fixtures
    route('/user-create', 'routes/user-create.tsx'),
    route('/order-create', 'routes/order-create.tsx'),
    route('/user-update', 'routes/user-update.tsx'),
    route('/user-type-mismatch', 'routes/user-type-mismatch.tsx'),
    route('/user-correct-types', 'routes/user-correct-types.tsx'),
    route('/unknown-table', 'routes/unknown-table.tsx'),
    route('/unknown-column', 'routes/unknown-column.tsx'),
    route('/null-notnull', 'routes/null-notnull.tsx'),
    route('/invalid-enum-literal', 'routes/invalid-enum-literal.tsx'),
    route('/string-to-timestamp', 'routes/string-to-timestamp.tsx'),
    route('/string-to-json', 'routes/string-to-json.tsx'),
    route('/write-autogen', 'routes/write-autogen.tsx'),
    route('/update-null-notnull', 'routes/update-null-notnull.tsx'),
    route('/delete-no-where', 'routes/delete-no-where.tsx'),
    route('/update-no-where', 'routes/update-no-where.tsx'),
    route('/delete-with-where', 'routes/delete-with-where.tsx'),
    route('/import-alias/:id?', 'routes/import-alias.tsx'),
    // Interactivity check fixtures
    route('/disconnected-dialog', 'routes/disconnected-dialog.tsx'),
    route('/connected-dialog', 'routes/connected-dialog.tsx'),
    // Event handler false positive test
    route('/event-handlers', 'routes/event-handlers.tsx'),
    // Protocol links test
    route('/protocol-links', 'routes/protocol-links.tsx'),
    // Intent dispatch with top-level field reads
    route('/intent-toplevel', 'routes/intent-toplevel.tsx'),
    // Intent dispatch with type-cast intent variable
    route('/intent-typecast', 'routes/intent-typecast.tsx'),
    // SQL extraction test fixtures
    route('/sql-operations/:id?', 'routes/sql-operations.tsx'),
    route('/sql-joins', 'routes/sql-joins.tsx'),
    // Client loader check fixtures
    route('/client-loader-db', 'routes/client-loader-db.tsx'),
    route('/client-loader-safe', 'routes/client-loader-safe.tsx'),
    // Component href detection test
    route('/component-links', 'routes/component-links.tsx'),
    // Raw SQL tagged template literal test
    route('/sql-raw-subquery', 'routes/sql-raw-subquery.tsx'),
    // Aggregate type assertion test
    route('/sql-aggregate-types', 'routes/sql-aggregate-types.tsx'),
  ]),
] satisfies RouteConfig;
