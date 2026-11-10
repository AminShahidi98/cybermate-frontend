import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { CONTRACT_TYPES, Contract, Paginated } from "../api/types";
import { useCurrentUser } from "../auth/AuthContext";
import { PageHeader } from "../components/ui";
import { formatDate, formatMoney } from "../utils";

interface Card {
  label: string;
  to: string;
  path: string;
  query: Record<string, string | number>;
}

export default function DashboardPage() {
  const { user, isManager } = useCurrentUser();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [contract, setContract] = useState<Contract | null | undefined>(undefined);

  const myCards: Card[] = [
    { label: "My draft timesheets", to: "/timesheets?status=draft&mine=1", path: "/timesheets/", query: { user: user.id, status: "draft" } },
    { label: "My rejected timesheets", to: "/timesheets?status=rejected&mine=1", path: "/timesheets/", query: { user: user.id, status: "rejected" } },
    { label: "My pending leave", to: "/leave?status=pending&mine=1", path: "/leave-requests/", query: { user: user.id, status: "pending" } },
  ];
  const reviewCards: Card[] = isManager
    ? [
        { label: "Timesheets to review", to: "/timesheets?status=submitted", path: "/timesheets/", query: { status: "submitted" } },
        { label: "Leave to review", to: "/leave?status=pending", path: "/leave-requests/", query: { status: "pending" } },
      ]
    : [];
  const cards = [...reviewCards, ...myCards];
  const cardsKey = JSON.stringify(cards);

  useEffect(() => {
    let cancelled = false;
    const list = JSON.parse(cardsKey) as Card[];
    Promise.all(
      list.map((card) =>
        api<Paginated<unknown>>(card.path, { query: card.query })
          .then((data) => data.count)
          .catch(() => null),
      ),
    ).then((values) => {
      if (!cancelled) setCounts(Object.fromEntries(list.map((card, i) => [card.label, values[i]])));
    });
    api<Paginated<Contract>>("/contracts/", { query: { user: user.id, status: "active" } })
      .then((data) => !cancelled && setContract(data.results[0] ?? null))
      .catch(() => !cancelled && setContract(null));
    return () => {
      cancelled = true;
    };
  }, [cardsKey, user.id]);

  return (
    <>
      <PageHeader title={`Hello, ${user.first_name || user.email}`} subtitle="Here's what needs your attention." />

      <div className="cards">
        {cards.map((card) => (
          <Link key={card.label} to={card.to} className={`stat-card ${reviewCards.includes(card) ? "highlight" : ""}`}>
            <span className="stat-value">{counts[card.label] ?? "–"}</span>
            <span className="stat-label">{card.label}</span>
          </Link>
        ))}
      </div>

      <section className="panel">
        <h2>My current contract</h2>
        {contract === undefined && <p className="muted">Loading…</p>}
        {contract === null && <p className="muted">No active contract on file.</p>}
        {contract && (
          <dl className="details">
            <dt>Type</dt>
            <dd>{CONTRACT_TYPES[contract.contract_type]}</dd>
            <dt>Job title</dt>
            <dd>{contract.job_title}</dd>
            <dt>Started</dt>
            <dd>{formatDate(contract.start_date)}</dd>
            <dt>Ends</dt>
            <dd>{contract.end_date ? formatDate(contract.end_date) : "Open-ended"}</dd>
            <dt>Weekly hours</dt>
            <dd>{Number(contract.weekly_hours)}</dd>
            <dt>Annual salary</dt>
            <dd>{formatMoney(contract.annual_salary, contract.currency)}</dd>
          </dl>
        )}
      </section>

      <section className="panel quick-actions">
        <h2>Quick actions</h2>
        <div className="row">
          <Link className="button" to="/timesheets?new=1">
            Log hours
          </Link>
          <Link className="button secondary" to="/leave?new=1">
            Request leave
          </Link>
        </div>
      </section>
    </>
  );
}
