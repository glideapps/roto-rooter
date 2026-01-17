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
  ]),
] satisfies RouteConfig;
