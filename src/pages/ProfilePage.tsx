import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { useCurrentUser } from "../auth/AuthContext";
import { ErrorBox, Field, PageHeader } from "../components/ui";
import { useFormState } from "../hooks";
import { errorMessage, formatDate } from "../utils";

export default function ProfilePage() {
  const { user, reloadUser } = useCurrentUser();
  const { values, bind } = useFormState({
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    department: user.department,
    job_title: user.job_title,
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api("/users/me/", { method: "PATCH", body: values });
      await reloadUser();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="My profile" subtitle={`${user.email} · member since ${formatDate(user.created_at)}`} />
      <section className="panel narrow">
        <form className="form" onSubmit={handleSubmit}>
          <div className="grid-2">
            <Field label="First name">
              <input maxLength={150} {...bind("first_name")} />
            </Field>
            <Field label="Last name">
              <input maxLength={150} {...bind("last_name")} />
            </Field>
            <Field label="Phone">
              <input type="tel" maxLength={32} {...bind("phone")} />
            </Field>
            <Field label="Department">
              <input maxLength={120} {...bind("department")} />
            </Field>
          </div>
          <Field label="Job title">
            <input maxLength={120} {...bind("job_title")} />
          </Field>
          <Field label="Roles">
            <span>{user.roles.map((role) => role.name).join(", ") || "None assigned"}</span>
          </Field>
          <ErrorBox message={error} />
          {saved && <div className="success-box">Profile saved.</div>}
          <div className="form-actions">
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
