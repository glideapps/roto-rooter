import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  parseRoutes,
  getAllRoutePaths,
  matchRoute,
  matchDynamicPattern,
} from '../src/parsers/route-parser.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');
const multiFileDir = path.join(__dirname, 'fixtures/multi-file-app');

describe('route-parser', () => {
  describe('parseRoutes', () => {
    it('should parse routes from app/routes.ts', () => {
      const routes = parseRoutes(fixturesDir);

      expect(routes.map((r) => r.path)).toEqual([
        '/',
        '/employees',
        '/employees/:id',
        '/employees/:id/edit',
        '/tasks',
        '/contact',
        '/feedback',
        '/intent-dispatch',
        '/query-links',
        '/server-dates',
        '/hydration-dedup',
        '/component-inputs',
        '/user-create',
        '/order-create',
        '/user-update',
        '/user-type-mismatch',
        '/user-correct-types',
        '/unknown-table',
        '/unknown-column',
        '/null-notnull',
        '/invalid-enum-literal',
        '/string-to-timestamp',
        '/string-to-json',
        '/write-autogen',
        '/update-null-notnull',
        '/delete-no-where',
        '/update-no-where',
        '/delete-with-where',
        '/import-alias/:id?',
        '/disconnected-dialog',
        '/connected-dialog',
        '/event-handlers',
        '/protocol-links',
        '/intent-toplevel',
        '/intent-typecast',
        '/sql-operations/:id?',
        '/sql-joins',
        '/client-loader-db',
        '/client-loader-safe',
        '/component-links',
        '/sql-raw-subquery',
      ]);
    });

    it('should extract params from route paths', () => {
      const routes = parseRoutes(fixturesDir);
      const employeeDetailRoute = routes.find(
        (r) => r.path === '/employees/:id'
      );

      expect(employeeDetailRoute?.params).toEqual(['id']);
    });

    it('should extract route IDs', () => {
      const routes = parseRoutes(fixturesDir);
      const homeRoute = routes.find((r) => r.path === '/');

      expect(homeRoute?.id).toBe('home');
    });
  });

  describe('multi-file route imports', () => {
    it('should resolve routes spread from imported files', () => {
      const routes = parseRoutes(multiFileDir);
      const paths = routes.map((r) => r.path);

      // Routes from trusted-routes.ts (via spread)
      expect(paths).toContain('/oauth/callback');
      expect(paths).toContain('/logout');

      // Routes from app-routes.ts (via spread, inside layout)
      expect(paths).toContain('/');
      expect(paths).toContain('/employees');
      expect(paths).toContain('/employees/:id');
    });

    it('should extract all 5 routes from multi-file config', () => {
      const routes = parseRoutes(multiFileDir);
      expect(routes).toHaveLength(5);
    });

    it('should preserve route IDs from imported files', () => {
      const routes = parseRoutes(multiFileDir);
      const homeRoute = routes.find((r) => r.path === '/');
      expect(homeRoute?.id).toBe('home');
    });

    it('should preserve route order: trusted routes first, then app routes', () => {
      const routes = parseRoutes(multiFileDir);
      const paths = routes.map((r) => r.path);

      expect(paths).toEqual([
        '/oauth/callback',
        '/logout',
        '/',
        '/employees',
        '/employees/:id',
      ]);
    });
  });

  describe('getAllRoutePaths', () => {
    it('should return all route paths', () => {
      const routes = parseRoutes(fixturesDir);
      const paths = getAllRoutePaths(routes);

      expect(paths).toContain('/');
      expect(paths).toContain('/employees');
      expect(paths).toContain('/employees/:id');
      expect(paths).toContain('/tasks');
    });
  });

  describe('matchRoute', () => {
    it('should match static routes exactly', () => {
      const routes = parseRoutes(fixturesDir);

      const match = matchRoute('/employees', routes);
      expect(match?.path).toBe('/employees');
    });

    it('should match dynamic routes', () => {
      const routes = parseRoutes(fixturesDir);

      const match = matchRoute('/employees/123', routes);
      expect(match?.path).toBe('/employees/:id');
    });

    it('should return undefined for non-existent routes', () => {
      const routes = parseRoutes(fixturesDir);

      const match = matchRoute('/nonexistent', routes);
      expect(match).toBeUndefined();
    });
  });

  describe('matchDynamicPattern', () => {
    it('should match dynamic patterns to routes', () => {
      const routes = parseRoutes(fixturesDir);

      const match = matchDynamicPattern('/employees/:param', routes);
      expect(match?.path).toBe('/employees/:id');
    });

    it('should not match patterns with wrong static segments', () => {
      const routes = parseRoutes(fixturesDir);

      const match = matchDynamicPattern('/tasks/:param', routes);
      expect(match).toBeUndefined();
    });
  });
});
