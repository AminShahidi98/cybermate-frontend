import { useEffect, useState } from "react";
import { api, fetchAll } from "../api/client";
import { Role, User } from "../api/types";
import { useCurrentUser } from "../auth/AuthContext";
import { ListToolbar, SelectCheckbox, deleteEach, rowClickToggles } from "../components/ListToolbar";
import { ErrorBox, Field, FormModal, ListState, PageHeader, Pagination } from "../components/ui";
import { useDebounced, useFormState, usePaginated, useSelection } from "../hooks";
import { formatDate, fullName } from "../utils";

export default function UsersPage() {
  const { user: me } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [actionError, setActionError] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = usePaginated<User>("/users/", { search: debouncedSearch, ordering: "first_name" });
  const rows = list.data?.results ?? [];
  const selection = useSelection(rows);
  const includesMe = selection.selected.some((u) => u.id === me.id);

  useEffect(() => {
    fetchAll<Role>("/roles/")
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  async function removeSelected() {
    const targets = selection.selected;
    const question =
      targets.length === 1
        ? `Delete ${fullName(targets[0])} (${targets[0].email})?`
        : `Delete these ${targets.length} users?`;
    if (!window.confirm(`${question} Their contracts, timesheets and leave requests are deleted too. This can't be undone.`)) return;
    setActionError("");
    setActionError(await deleteEach(targets, (u) => `/users/${u.id}/`, (u) => u.email));
    await list.reload();
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone who can sign in, and their roles." />

      <ListToolbar
        onNew={{ onClick: () => setEditing("new") }}
        onEdit={{
          onClick: () => selection.single && setEditing(selection.single),
          disabled: !selection.single,
          title: selection.single ? undefined : "Select one user to edit",
        }}
        onDelete={{
          onClick: removeSelected,
          disabled: selection.selected.length === 0 || includesMe,
          title: includesMe ? "You can't delete your own account" : selection.selected.length === 0 ? "Select users to delete" : undefined,
        }}
        search={{ value: search, onChange: setSearch, placeholder: "Search name, email, department…" }}
        selectedCount={selection.selected.length}
      />

      <ErrorBox message={actionError} />

      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} emptyText="No users match.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="select-col">
                  <SelectCheckbox
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected}
                    onChange={selection.toggleAll}
                    label="Select all users on this page"
                  />
                </th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Job title</th>
                <th>Roles</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr
                  key={u.id}
                  className={["selectable", u.is_active ? "" : "inactive", selection.isSelected(u.id) ? "selected" : ""].join(" ")}
                  onClick={rowClickToggles(() => selection.toggle(u.id))}
                >
                  <td className="select-col">
                    <input
                      type="checkbox"
                      checked={selection.isSelected(u.id)}
                      onChange={() => selection.toggle(u.id)}
                      aria-label={`Select ${fullName(u)}`}
                    />
                  </td>
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
