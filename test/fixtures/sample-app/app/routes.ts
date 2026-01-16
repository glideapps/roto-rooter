import { type RouteConfig, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/_layout.tsx", [
    route("/", "routes/dashboard.tsx", { id: "home" }),
    route("/employees", "routes/employees.tsx"),
    route("/employees/:id", "routes/employees.$id.tsx"),
    route("/tasks", "routes/tasks.tsx"),
  ]),
] satisfies RouteConfig;
