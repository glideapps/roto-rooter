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
  ]),
] satisfies RouteConfig;
