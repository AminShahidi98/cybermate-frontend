import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { TIMESHEET_STATUSES, Timesheet } from "../api/types";
import { useCurrentUser } from "../auth/AuthContext";
import { ListToolbar, SelectCheckbox, deleteEach, rowClickToggles } from "../components/ListToolbar";
import { ErrorBox, Field, FormModal, ListState, PageHeader, Pagination, StatusBadge } from "../components/ui";
import { useDebounced, useFormState, usePaginated, useSelection } from "../hooks";
import { errorMessage, formatDate, formatDateTime, todayISO } from "../utils";

export default function TimesheetsPage() {
  const { user, isManager } = useCurrentUser();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(params.get("mine") === "1");
  const [editing, setEditing] = useState<Timesheet | "new" | null>(params.get("new") === "1" ? "new" : null);
  const [actionError, setActionError] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = usePaginated<Timesheet>("/timesheets/", {
    status,
    search: debouncedSearch,
    user: isManager && mineOnly ? user.id : undefined,
    ordering: "-work_date",
  });
  const rows = list.data?.results ?? [];
  const showEmployee = isManager && !mineOnly;
  const selection = useSelection(rows);

  // You can edit your own draft or rejected entries, and delete your own drafts.
  const canEdit = (entry: Timesheet) => entry.user === user.id && (entry.status === "draft" || entry.status === "rejected");
  const canDelete = (entry: Timesheet) => entry.user === user.id && entry.status === "draft";
  const editTarget = selection.single && canEdit(selection.single) ? selection.single : null;
  const deletable = selection.selected.length > 0 && selection.selected.every(canDelete);

  async function run(action: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setActionError("");
    try {
      await action();
      await list.reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  async function removeSelected() {
    const targets = selection.selected;
    const question = targets.length === 1 ? "Delete this draft entry?" : `Delete these ${targets.length} draft entries?`;
    if (!window.confirm(question)) return;
    setActionError("");
    setActionError(
      await deleteEach(targets, (t) => `/timesheets/${t.id}/`, (t) => `${formatDate(t.work_date)} ${t.project || ""}`.trim()),
    );
    await list.reload();
  }

  return (
    <>
      <PageHeader
        title="Timesheets"
        subtitle={isManager ? "Log your hours and review your team's entries." : "Log your hours and submit them for approval."}
      />

      <ListToolbar
        onNew={{ onClick: () => setEditing("new") }}
        onEdit={{
          onClick: () => editTarget && setEditing(editTarget),
          disabled: !editTarget,
          title: editTarget
            ? undefined
            : selection.single
              ? "Only your own draft or rejected entries can be edited"
              : "Select one entry to edit",
        }}
        onDelete={{
          onClick: removeSelected,
          disabled: !deletable,
          title: deletable
            ? undefined
            : selection.selected.length
              ? "Only your own draft entries can be deleted"
              : "Select entries to delete",
        }}
        search={{ value: search, onChange: setSearch, placeholder: "Search project, client, description…" }}
        selectedCount={selection.selected.length}
      >
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(TIMESHEET_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {isManager && (
          <label className="checkbox">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            Only mine
          </label>
        )}
      </ListToolbar>

      <ErrorBox message={actionError} />

      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} emptyText="No timesheet entries match.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="select-col">
                  <SelectCheckbox
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected}
                    onChange={selection.toggleAll}
                    label="Select all entries on this page"
                  />
                </th>
                <th>Date</th>
                {showEmployee && <th>Employee</th>}
                <th>Project</th>
                <th>Client</th>
                <th className="num">Hours</th>
                <th>Description</th>
                <th>Status</th>
                <th>Reviewed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr
                  key={entry.id}
                  className={`selectable ${selection.isSelected(entry.id) ? "selected" : ""}`}
                  onClick={rowClickToggles(() => selection.toggle(entry.id))}
                >
                  <td className="select-col">
                    <input
                      type="checkbox"
                      checked={selection.isSelected(entry.id)}
                      onChange={() => selection.toggle(entry.id)}
                      aria-label={`Select entry for ${formatDate(entry.work_date)}`}
                    />
                  </td>
                  <td className="nowrap">{formatDate(entry.work_date)}</td>
                  {showEmployee && <td>{entry.user_email}</td>}
                  <td>{entry.project || "—"}</td>
                  <td>{entry.client || "—"}</td>
                  <td className="num">{Number(entry.hours)}</td>
                  <td className="wrap">{entry.description || "—"}</td>
                  <td>
                    <StatusBadge status={entry.status} label={TIMESHEET_STATUSES[entry.status]} />
                  </td>
                  <td className="small muted">
                    {entry.reviewer_email ? (
                      <>
                        {entry.reviewer_email}
                        <br />
                        {formatDateTime(entry.reviewed_at)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="actions">
                    {canEdit(entry) && (
                      <button className="link" onClick={() => run(() => api(`/timesheets/${entry.id}/submit/`, { method: "POST" }))}>
                        Submit
                      </button>
                    )}
                    {isManager && entry.status === "submitted" && (
                      <>
                        <button
                          className="link success"
                          onClick={() => run(() => api(`/timesheets/${entry.id}/review/`, { method: "POST", body: { decision: "approved" } }))}
                        >
                          Approve
                        </button>
                        <button
                          className="link danger"
                          onClick={() =>
                            run(
                              () => api(`/timesheets/${entry.id}/review/`, { method: "POST", body: { decision: "rejected" } }),
                              `Reject ${entry.user_email}'s entry for ${formatDate(entry.work_date)}?`,
                            )
                          }
                        >
                          Reject
                        </button>
                      </>
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
        <TimesheetForm
          entry={editing === "new" ? null : editing}
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

function TimesheetForm({ entry, onClose, onSaved }: { entry: Timesheet | null; onClose: () => void; onSaved: () => void }) {
  const { values, bind } = useFormState({
    work_date: entry?.work_date ?? todayISO(),
    hours: entry ? String(Number(entry.hours)) : "8",
    project: entry?.project ?? "",
    client: entry?.client ?? "",
    description: entry?.description ?? "",
  });

  async function save() {
    if (entry) await api(`/timesheets/${entry.id}/`, { method: "PATCH", body: values });
    else await api("/timesheets/", { method: "POST", body: values });
    onSaved();
  }

  return (
    <FormModal title={entry ? "Edit timesheet entry" : "Log hours"} onClose={onClose} onSubmit={save}>
      <div className="grid-2">
        <Field label="Date">
          <input type="date" required {...bind("work_date")} />
        </Field>
        <Field label="Hours">
          <input type="number" required min="0.25" max="24" step="0.25" {...bind("hours")} />
        </Field>
        <Field label="Project">
          <input maxLength={160} {...bind("project")} />
        </Field>
        <Field label="Client">
          <input maxLength={160} {...bind("client")} />
        </Field>
      </div>
      <Field label="What did you work on?">
        <textarea rows={3} {...bind("description")} />
      </Field>
      <p className="field-hint">You can only have one entry per day for the same project. Saved entries stay as drafts until you submit them.</p>
    </FormModal>
  );
}
