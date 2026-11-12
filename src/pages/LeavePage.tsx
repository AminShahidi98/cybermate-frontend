import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { LEAVE_STATUSES, LEAVE_TYPES, LeaveRequest } from "../api/types";
import { useCurrentUser } from "../auth/AuthContext";
import { ListToolbar, SelectCheckbox, deleteEach, rowClickToggles } from "../components/ListToolbar";
import { ErrorBox, Field, FormModal, ListState, Modal, PageHeader, Pagination, StatusBadge } from "../components/ui";
import { useDebounced, useFormState, usePaginated, useSelection } from "../hooks";
import { daysBetween, errorMessage, formatDate, todayISO } from "../utils";

export default function LeavePage() {
  const { user, isManager } = useCurrentUser();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [leaveType, setLeaveType] = useState("");
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(params.get("mine") === "1");
  const [editing, setEditing] = useState<LeaveRequest | "new" | null>(params.get("new") === "1" ? "new" : null);
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null);
  const [actionError, setActionError] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = usePaginated<LeaveRequest>("/leave-requests/", {
    status,
    leave_type: leaveType,
    search: debouncedSearch,
    user: isManager && mineOnly ? user.id : undefined,
    ordering: "-start_date",
  });
  const rows = list.data?.results ?? [];
  const showEmployee = isManager && !mineOnly;
  const selection = useSelection(rows);

  // Only your own pending requests can be edited or cancelled (the API turns DELETE into "cancelled").
  const ownPending = (leave: LeaveRequest) => leave.user === user.id && leave.status === "pending";
  const editTarget = selection.single && ownPending(selection.single) ? selection.single : null;
  const cancellable = selection.selected.length > 0 && selection.selected.every(ownPending);

  async function cancelSelected() {
    const targets = selection.selected;
    const question = targets.length === 1 ? "Cancel this leave request?" : `Cancel these ${targets.length} leave requests?`;
    if (!window.confirm(question)) return;
    setActionError("");
    setActionError(
      await deleteEach(targets, (l) => `/leave-requests/${l.id}/`, (l) => `${LEAVE_TYPES[l.leave_type]} from ${formatDate(l.start_date)}`),
    );
    await list.reload();
  }

  return (
    <>
      <PageHeader
        title="Leave requests"
        subtitle={isManager ? "Request time off and review your team's requests." : "Request time off and track its approval."}
      />

      <ListToolbar
        onNew={{ onClick: () => setEditing("new") }}
        onEdit={{
          onClick: () => editTarget && setEditing(editTarget),
          disabled: !editTarget,
          title: editTarget
            ? undefined
            : selection.single
              ? "Only your own pending requests can be edited"
              : "Select one request to edit",
        }}
        onDelete={{
          label: "Cancel request",
          onClick: cancelSelected,
          disabled: !cancellable,
          title: cancellable
            ? undefined
            : selection.selected.length
              ? "Only your own pending requests can be cancelled"
              : "Select requests to cancel",
        }}
        search={{ value: search, onChange: setSearch, placeholder: "Search reason or email…" }}
        selectedCount={selection.selected.length}
      >
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(LEAVE_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} aria-label="Leave type">
          <option value="">All types</option>
          {Object.entries(LEAVE_TYPES).map(([value, label]) => (
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

      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} emptyText="No leave requests match.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="select-col">
                  <SelectCheckbox
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected}
                    onChange={selection.toggleAll}
                    label="Select all requests on this page"
                  />
                </th>
                {showEmployee && <th>Employee</th>}
                <th>Type</th>
                <th>Dates</th>
                <th className="num">Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewer</th>
                {isManager && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((leave) => (
                <tr
                  key={leave.id}
                  className={`selectable ${selection.isSelected(leave.id) ? "selected" : ""}`}
                  onClick={rowClickToggles(() => selection.toggle(leave.id))}
                >
                  <td className="select-col">
                    <input
                      type="checkbox"
                      checked={selection.isSelected(leave.id)}
                      onChange={() => selection.toggle(leave.id)}
                      aria-label={`Select request from ${formatDate(leave.start_date)}`}
                    />
                  </td>
                  {showEmployee && <td>{leave.user_email}</td>}
                  <td>{LEAVE_TYPES[leave.leave_type]}</td>
                  <td className="nowrap">
                    {formatDate(leave.start_date)}
                    {leave.end_date !== leave.start_date && <> – {formatDate(leave.end_date)}</>}
                  </td>
                  <td className="num">{daysBetween(leave.start_date, leave.end_date)}</td>
                  <td className="wrap">{leave.reason || "—"}</td>
                  <td>
                    <StatusBadge status={leave.status} label={LEAVE_STATUSES[leave.status]} />
                  </td>
                  <td className="small">
                    {leave.reviewer_email ? (
                      <>
                        <span className="muted">{leave.reviewer_email}</span>
                        {leave.reviewer_comment && <div className="comment">“{leave.reviewer_comment}”</div>}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  {isManager && (
                    <td className="actions">
                      {leave.status === "pending" && (
                        <button className="link success" onClick={() => setReviewing(leave)}>
                          Review
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && <Pagination count={list.data.count} page={list.page} onPage={list.setPage} />}
      </ListState>

      {editing && (
        <LeaveForm
          leave={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void list.reload();
          }}
        />
      )}
      {reviewing && (
        <ReviewModal
          leave={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            void list.reload();
          }}
        />
      )}
    </>
  );
}

function LeaveForm({ leave, onClose, onSaved }: { leave: LeaveRequest | null; onClose: () => void; onSaved: () => void }) {
  const { values, bind } = useFormState({
    leave_type: leave?.leave_type ?? "annual",
    start_date: leave?.start_date ?? todayISO(),
    end_date: leave?.end_date ?? todayISO(),
    reason: leave?.reason ?? "",
  });

  async function save() {
    if (leave) await api(`/leave-requests/${leave.id}/`, { method: "PATCH", body: values });
    else await api("/leave-requests/", { method: "POST", body: values });
    onSaved();
  }

  return (
    <FormModal title={leave ? "Edit leave request" : "Request leave"} submitLabel={leave ? "Save" : "Send request"} onClose={onClose} onSubmit={save}>
      <Field label="Type">
        <select {...bind("leave_type")}>
          {Object.entries(LEAVE_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid-2">
        <Field label="First day">
          <input type="date" required {...bind("start_date")} />
        </Field>
        <Field label="Last day">
          <input type="date" required min={values.start_date} {...bind("end_date")} />
        </Field>
      </div>
      <Field label="Reason" hint="Optional, visible to your manager.">
        <textarea rows={3} {...bind("reason")} />
      </Field>
    </FormModal>
  );
}

function ReviewModal({ leave, onClose, onDone }: { leave: LeaveRequest; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    setError("");
    try {
      await api(`/leave-requests/${leave.id}/review/`, { method: "POST", body: { decision, comment } });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal title="Review leave request" onClose={onClose}>
      <div className="form">
        <dl className="details">
          <dt>Employee</dt>
          <dd>{leave.user_email}</dd>
          <dt>Type</dt>
          <dd>{LEAVE_TYPES[leave.leave_type]}</dd>
          <dt>Dates</dt>
          <dd>
            {formatDate(leave.start_date)} – {formatDate(leave.end_date)} ({daysBetween(leave.start_date, leave.end_date)} days)
          </dd>
          <dt>Reason</dt>
          <dd>{leave.reason || "—"}</dd>
        </dl>
        <Field label="Comment" hint="Optional, shown to the employee.">
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <ErrorBox message={error} />
        <div className="form-actions">
          <button className="button secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button className="button danger" onClick={() => decide("rejected")} disabled={busy}>
            Reject
          </button>
          <button className="button success" onClick={() => decide("approved")} disabled={busy}>
            Approve
          </button>
        </div>
      </div>
    </Modal>
  );
}
