import { useEffect, useState } from "react";
import { api, fetchAll } from "../api/client";
import { Role, User } from "../api/types";
import { useCurrentUser } from "../auth/AuthContext";
import { ErrorBox, Field, FormModal, ListState, PageHeader, Pagination } from "../components/ui";
import { useDebounced, useFormState, usePaginated } from "../hooks";
import { errorMessage, formatDate, fullName } from "../utils";

export default function UsersPage() {
  const { user: me } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [actionError, setActionError] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = usePaginated<User>("/users/", { search: debouncedSearch, ordering: "first_name" });
  const rows = list.data?.results ?? [];

  useEffect(() => {
    fetchAll<Role>("/roles/")
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  async function remove(target: User) {
    if (!window.confirm(`Delete ${fullName(target)} (${target.email})? Their contracts, timesheets and leave requests are deleted too. This can't be undone.`)) return;
    setActionError("");
    try {
      await api(`/users/${target.id}/`, { method: "DELETE" });
      await list.reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone who can sign in, and their roles."
        actions={
          <button className="button" onClick={() => setEditing("new")}>
            Add user
          </button>
        }
      />

      <div className="filters">
        <input type="search" placeholder="Search name, email, department…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <ErrorBox message={actionError} />

      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} emptyText="No users match.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Job title</th>
                <th>Roles</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={u.is_active ? "" : "inactive"}>
                  <td>
                    {fullName(u)}
                    {!u.is_active && <span className="badge badge-ended">Inactive</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.department || "—"}</td>
                  <td>{u.job_title || "—"}</td>
                  <td>
                    {u.roles.length ? (
                      u.roles.map((role) => (
                        <span key={role.id} className={`badge badge-role-${role.code}`}>
                          {role.name}
                        </span>
                      ))
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="nowrap">{formatDate(u.created_at)}</td>
                  <td className="actions">
                    <button className="link" onClick={() => setEditing(u)}>
                      Edit
                    </button>
                    {u.id !== me.id && (
                      <button className="link danger" onClick={() => remove(u)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && <Pagination count={list.data.count} page={list.page} onPage={list.setPage} />}
      </ListState>

      {editing && (
        <UserForm
          target={editing === "new" ? null : editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void list.reload();
          }}
        />
      )}
    </>
  );
}

function UserForm({ target, roles, onClose, onSaved }: { target: User | null; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const { values, bind } = useFormState({
    email: target?.email ?? "",
    first_name: target?.first_name ?? "",
    last_name: target?.last_name ?? "",
    phone: target?.phone ?? "",
    department: target?.department ?? "",
    job_title: target?.job_title ?? "",
    password: "",
  });
  const [roleIds, setRoleIds] = useState<number[]>(target?.roles.map((role) => role.id) ?? []);

  function toggleRole(id: number) {
    setRoleIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function save() {
    const { password, ...profile } = values;
    if (target) {
      await api(`/users/${target.id}/`, { method: "PATCH", body: { ...profile, role_ids: roleIds } });
    } else {
      await api("/users/", { method: "POST", body: { ...profile, password, role_ids: roleIds } });
    }
    onSaved();
  }

  return (
    <FormModal title={target ? `Edit ${fullName(target)}` : "Add user"} onClose={onClose} onSubmit={save}>
      <Field label="Email" hint="Used to sign in.">
        <input type="email" required maxLength={254} {...bind("email")} />
      </Field>
      <div className="grid-2">
        <Field label="First name">
          <input maxLength={150} {...bind("first_name")} />
        </Field>
        <Field label="Last name">
          <input maxLength={150} {...bind("last_name")} />
        </Field>
        <Field label="Department">
          <input maxLength={120} {...bind("department")} />
        </Field>
        <Field label="Job title">
          <input maxLength={120} {...bind("job_title")} />
        </Field>
        <Field label="Phone">
          <input type="tel" maxLength={32} {...bind("phone")} />
        </Field>
      </div>
      {!target && (
        <Field label="Initial password" hint="At least 12 characters, not too common.">
          <input type="password" required minLength={12} autoComplete="new-password" {...bind("password")} />
        </Field>
      )}
      <fieldset className="field">
        <legend className="field-label">Roles</legend>
        <div className="row">
          {roles.map((role) => (
            <label key={role.id} className="checkbox">
              <input type="checkbox" checked={roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />
              {role.name}
            </label>
          ))}
          {roles.length === 0 && <span className="muted">No roles found.</span>}
        </div>
      </fieldset>
    </FormModal>
  );
}
