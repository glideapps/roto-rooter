import { route } from '@react-router/dev/routes';

const trustedRoutes = [
  route('/oauth/callback', 'routes/oauth.callback.tsx'),
  route('/logout', 'routes/logout.tsx'),
];

export default trustedRoutes;
