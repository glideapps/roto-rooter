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
    // Interactivity check fixtures
    route('/disconnected-dialog', 'routes/disconnected-dialog.tsx'),
    route('/connected-dialog', 'routes/connected-dialog.tsx'),
    // Event handler false positive test
    route('/event-handlers', 'routes/event-handlers.tsx'),
    // Protocol links test
    route('/protocol-links', 'routes/protocol-links.tsx'),
    // Intent dispatch with top-level field reads
    route('/intent-toplevel', 'routes/intent-toplevel.tsx'),
  ]),
] satisfies RouteConfig;
