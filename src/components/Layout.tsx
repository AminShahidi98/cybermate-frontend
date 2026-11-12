import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../auth/AuthContext";
import { fullName } from "../utils";
import GlobalSearch, { SearchTarget } from "./GlobalSearch";

export default function Layout() {
  const { user, isAdmin, isManager, logout } = useCurrentUser();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const roleLabel = isAdmin ? "Administrator" : isManager ? "Manager" : "Employee";

  const links: { to: string; label: string; end?: boolean; keywords?: string }[] = [
    { to: "/", label: "Dashboard", end: true, keywords: "home overview" },
    { to: "/timesheets", label: "Timesheets", keywords: "hours time entries" },
    { to: "/leave", label: "Leave requests", keywords: "holiday vacation absence time off sick" },
    { to: "/contracts", label: "Contracts", keywords: "employment salary" },
    ...(isManager ? [{ to: "/departments", label: "Departments", keywords: "teams" }] : []),
    ...(isAdmin
      ? [
          { to: "/users", label: "Users", keywords: "people employees accounts" },
          { to: "/roles", label: "Roles", keywords: "permissions admin manager employee" },
        ]
      : []),
  ];

  // Everything the global search can find: the same pages as the sidebar, plus a few shortcuts.
  const searchTargets: SearchTarget[] = [
    ...links.map((link) => ({ label: link.label, to: link.to, kind: "Page", keywords: link.keywords })),
    { label: "My profile", to: "/profile", kind: "Page", keywords: "account phone name settings" },
    { label: "Log hours", to: "/timesheets?new=1", kind: "Action", keywords: "new timesheet entry add" },
    { label: "Request leave", to: "/leave?new=1", kind: "Action", keywords: "new leave holiday vacation day off" },
    ...(isManager
      ? [
          { label: "Timesheets to review", to: "/timesheets?status=submitted", kind: "Action", keywords: "approve reject submitted" },
          { label: "Leave requests to review", to: "/leave?status=pending", kind: "Action", keywords: "approve reject pending" },
        ]
      : []),
  ];

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">Cybermate</div>
        <nav onClick={() => setMenuOpen(false)}>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="nav-link">
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/profile" className="profile-link" onClick={() => setMenuOpen(false)}>
            <span className="avatar">{fullName(user).slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{fullName(user)}</strong>
              <small>{roleLabel}</small>
            </span>
          </NavLink>
          <button className="button secondary small full" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Menu">
            ☰
          </button>
          <span className="brand">Cybermate</span>
          <GlobalSearch targets={searchTargets} />
        </header>
        {/* A new key on every navigation re-opens the page fresh, so shortcuts like
            "Log hours" (/timesheets?new=1) also work when you're already on that page. */}
        <main className="content" key={location.key}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
