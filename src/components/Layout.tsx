import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useCurrentUser } from "../auth/AuthContext";
import { fullName } from "../utils";

export default function Layout() {
  const { user, isAdmin, isManager, logout } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const roleLabel = isAdmin ? "Administrator" : isManager ? "Manager" : "Employee";

  const links: { to: string; label: string; end?: boolean }[] = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/timesheets", label: "Timesheets" },
    { to: "/leave", label: "Leave requests" },
    { to: "/contracts", label: "Contracts" },
    ...(isAdmin
      ? [
          { to: "/users", label: "Users" },
          { to: "/roles", label: "Roles" },
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
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
