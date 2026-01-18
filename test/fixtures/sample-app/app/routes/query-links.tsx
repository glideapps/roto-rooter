import { Link } from 'react-router';

// This file tests that links with query strings and hash fragments are valid
// as long as the base path matches a route

export default function QueryLinksPage() {
  return (
    <div>
      <h1>Query String Links Demo</h1>

      {/* Valid: /employees exists, query string should be ignored for route matching */}
      <Link to="/employees?status=active">Active Employees</Link>
      <Link to="/employees?status=inactive&sort=name">Inactive Employees</Link>

      {/* Valid: /employees/:id exists, query string should be ignored */}
      <Link to="/employees/123?tab=details">Employee Details</Link>

      {/* Valid: hash fragments should be ignored for route matching */}
      <Link to="/employees#top">Employees (scroll to top)</Link>
      <Link to="/tasks#completed">Tasks (completed section)</Link>

      {/* Valid: both query string and hash */}
      <Link to="/employees?status=active#results">Active Employees Results</Link>

      {/* Anchor tags with query strings */}
      <a href="/feedback?source=header">Give Feedback</a>
      <a href="/contact#form">Contact Form</a>
    </div>
  );
}
