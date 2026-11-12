import { useEffect, useState } from "react";
import { api, fetchAll } from "../api/client";
import { CONTRACT_STATUSES, CONTRACT_TYPES, Contract, User } from "../api/types";
import { useCurrentUser } from "../auth/AuthContext";
import { ListToolbar, SelectCheckbox, deleteEach, rowClickToggles } from "../components/ListToolbar";
import { ErrorBox, Field, FormModal, ListState, PageHeader, Pagination, StatusBadge } from "../components/ui";
import { useDebounced, useFormState, usePaginated, useSelection } from "../hooks";
import { formatDate, formatMoney, fullName, todayISO } from "../utils";

export default function ContractsPage() {
  const { isManager } = useCurrentUser();
  const [status, setStatus] = useState("");
  const [contractType, setContractType] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Contract | "new" | null>(null);
  const [actionError, setActionError] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = usePaginated<Contract>("/contracts/", {
    status,
    contract_type: contractType,
    search: debouncedSearch,
    ordering: "-start_date",
  });
  const rows = list.data?.results ?? [];
  const selection = useSelection(rows);

  async function removeSelected() {
    const targets = selection.selected;
    const question =
      targets.length === 1
        ? `Delete this ${CONTRACT_TYPES[targets[0].contract_type].toLowerCase()} contract for ${targets[0].user_email}?`
        : `Delete these ${targets.length} contracts?`;
    if (!window.confirm(`${question} This can't be undone.`)) return;
    setActionError("");
    setActionError(
      await deleteEach(targets, (c) => `/contracts/${c.id}/`, (c) => `${c.user_email} (${CONTRACT_TYPES[c.contract_type]})`),
    );
    await list.reload();
  }

  return (
    <>
      <PageHeader
        title="Contracts"
        subtitle={isManager ? "Employment contracts for everyone in the company." : "Your employment contracts."}
      />

      <ListToolbar
        onNew={isManager ? { onClick: () => setEditing("new") } : undefined}
        onEdit={
          isManager
            ? {
                onClick: () => selection.single && setEditing(selection.single),
                disabled: !selection.single,
                title: selection.single ? undefined : "Select one contract to edit",
              }
            : undefined
        }
        onDelete={
          isManager
            ? {
                onClick: removeSelected,
                disabled: selection.selected.length === 0,
                title: selection.selected.length === 0 ? "Select contracts to delete" : undefined,
              }
            : undefined
        }
        search={isManager ? { value: search, onChange: setSearch, placeholder: "Search email or job title…" } : undefined}
        selectedCount={selection.selected.length}
      >
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(CONTRACT_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={contractType} onChange={(e) => setContractType(e.target.value)} aria-label="Contract type">
          <option value="">All types</option>
          {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <ErrorBox message={actionError} />

      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} emptyText="No contracts match.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isManager && (
                  <th className="select-col">
                    <SelectCheckbox
                      checked={selection.allSelected}
                      indeterminate={selection.someSelected}
                      onChange={selection.toggleAll}
                      label="Select all contracts on this page"
                    />
                  </th>
                )}
                {isManager && <th>Employee</th>}
                <th>Job title</th>
                <th>Type</th>
                <th>Period</th>
                <th className="num">Hours/week</th>
                <th className="num">Annual salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((contract) => (
                <tr
                  key={contract.id}
                  className={isManager ? `selectable ${selection.isSelected(contract.id) ? "selected" : ""}` : undefined}
                  onClick={isManager ? rowClickToggles(() => selection.toggle(contract.id)) : undefined}
                >
                  {isManager && (
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(contract.id)}
                        onChange={() => selection.toggle(contract.id)}
                        aria-label={`Select contract for ${contract.user_email}`}
                      />
                    </td>
                  )}
                  {isManager && <td>{contract.user_email}</td>}
                  <td>
                    {contract.job_title}
                    {contract.notes && <div className="small muted">{contract.notes}</div>}
                  </td>
                  <td>{CONTRACT_TYPES[contract.contract_type]}</td>
                  <td className="nowrap">
                    {formatDate(contract.start_date)} – {contract.end_date ? formatDate(contract.end_date) : "open-ended"}
                  </td>
                  <td className="num">{Number(contract.weekly_hours)}</td>
                  <td className="num">{formatMoney(contract.annual_salary, contract.currency)}</td>
                  <td>
                    <StatusBadge status={contract.status} label={CONTRACT_STATUSES[contract.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && <Pagination count={list.data.count} page={list.page} onPage={list.setPage} />}
      </ListState>

      {editing && (
        <ContractForm
          contract={editing === "new" ? null : editing}
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

function ContractForm({ contract, onClose, onSaved }: { contract: Contract | null; onClose: () => void; onSaved: () => void }) {
  const { isAdmin } = useCurrentUser();
  const [users, setUsers] = useState<User[] | null>(null);
  const { values, bind } = useFormState({
    user: contract ? String(contract.user) : "",
    contract_type: contract?.contract_type ?? "permanent",
    status: contract?.status ?? "draft",
    job_title: contract?.job_title ?? "",
    start_date: contract?.start_date ?? todayISO(),
    end_date: contract?.end_date ?? "",
    weekly_hours: contract ? String(Number(contract.weekly_hours)) : "40",
    annual_salary: contract?.annual_salary ? String(Number(contract.annual_salary)) : "",
    currency: contract?.currency ?? "EUR",
    notes: contract?.notes ?? "",
  });

  // Only admins may list users; managers type the user ID instead.
  useEffect(() => {
    if (!isAdmin) return;
    fetchAll<User>("/users/", { ordering: "first_name" })
      .then(setUsers)
      .catch(() => setUsers(null));
  }, [isAdmin]);

  async function save() {
    const body = {
      ...values,
      user: Number(values.user),
      end_date: values.end_date || null,
      annual_salary: values.annual_salary || null,
      currency: values.currency.toUpperCase(),
    };
    if (contract) await api(`/contracts/${contract.id}/`, { method: "PATCH", body });
    else await api("/contracts/", { method: "POST", body });
    onSaved();
  }

  return (
    <FormModal title={contract ? "Edit contract" : "New contract"} onClose={onClose} onSubmit={save}>
      {users ? (
        <Field label="Employee">
          <select required {...bind("user")}>
            <option value="" disabled>
              Choose an employee…
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {fullName(u)} ({u.email})
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Employee user ID" hint="Only administrators can browse the user list.">
          <input type="number" required min="1" {...bind("user")} />
        </Field>
      )}
      <div className="grid-2">
        <Field label="Contract type">
          <select {...bind("contract_type")}>
            {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select {...bind("status")}>
            {Object.entries(CONTRACT_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Job title">
        <input required maxLength={120} {...bind("job_title")} />
      </Field>
      <div className="grid-2">
        <Field label="Start date">
          <input type="date" required {...bind("start_date")} />
        </Field>
        <Field label="End date" hint="Leave empty if open-ended.">
          <input type="date" min={values.start_date} {...bind("end_date")} />
        </Field>
        <Field label="Weekly hours">
          <input type="number" required min="0.01" max="168" step="0.01" {...bind("weekly_hours")} />
        </Field>
        <Field label="Annual salary" hint="Leave empty if not applicable.">
          <input type="number" min="0" step="0.01" {...bind("annual_salary")} />
        </Field>
        <Field label="Currency">
          <input required maxLength={3} minLength={3} {...bind("currency")} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={2} {...bind("notes")} />
      </Field>
    </FormModal>
  );
}
