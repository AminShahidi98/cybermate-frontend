import { Department } from "../api/types";
import { ListState, PageHeader, Pagination } from "../components/ui";
import { usePaginated } from "../hooks";
import { formatDate } from "../utils";

export default function DepartmentsPage() {
  const list = usePaginated<Department>("/departments/", { ordering: "name" });
  const rows = list.data?.results ?? [];

  return (
    <>
      <PageHeader title="Departments" subtitle="All departments in the company." />

      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} emptyText="No departments yet.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="wrap">{d.description || "—"}</td>
                  <td>{d.status}</td>
                  <td className="nowrap">{formatDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && <Pagination count={list.data.count} page={list.page} onPage={list.setPage} />}
      </ListState>
    </>
  );
}
