import { describe, it, expect } from "vitest";
import * as path from "path";
import { parseRoutes } from "../src/parsers/route-parser.js";
import { parseComponent } from "../src/parsers/component-parser.js";
import { checkForms } from "../src/checks/form-check.js";

const fixturesDir = path.join(__dirname, "fixtures/sample-app");

describe("form-check", () => {
  it("should detect forms without action export", () => {
    const routes = parseRoutes(fixturesDir);
    const tasksPath = path.join(fixturesDir, "app/routes/tasks.tsx");
    const component = parseComponent(tasksPath);

    const issues = checkForms([component], routes, fixturesDir);

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("no action export");
  });

  it("should not flag forms with action export", () => {
    const routes = parseRoutes(fixturesDir);
    const employeeDetailPath = path.join(fixturesDir, "app/routes/employees.$id.tsx");
    const component = parseComponent(employeeDetailPath);

    const issues = checkForms([component], routes, fixturesDir);

    expect(issues).toHaveLength(0);
  });
});
