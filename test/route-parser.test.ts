import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  parseRoutes,
  getAllRoutePaths,
  matchRoute,
  matchDynamicPattern,
} from '../src/parsers/route-parser.js';

const fixturesDir = path.join(__dirname, 'fixtures/sample-app');

describe('route-parser', () => {
  describe('parseRoutes', () => {
    it('should parse routes from app/routes.ts', () => {
      const routes = parseRoutes(fixturesDir);

      expect(routes).toHaveLength(7);
      expect(routes.map((r) => r.path)).toEqual([
        '/',
        '/employees',
        '/employees/:id',
        '/employees/:id/edit',
        '/tasks',
        '/contact',
        '/feedback',
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
