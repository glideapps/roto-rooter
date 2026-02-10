import { type RouteConfig } from '@react-router/dev/routes';
import trustedRoutes from './trusted-routes';
import appRoutes from './app-routes';

export default [...trustedRoutes, ...appRoutes] satisfies RouteConfig;
