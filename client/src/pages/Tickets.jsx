import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, CATEGORIES, ErrorBox, label, PRIORITIES, Select, STATUSES, timeAgo } from '../components/ui';

const SORTS = [
  ['-createdAt', 'Newest first'],
  ['createdAt', 'Oldest first'],
  ['-updatedAt', 'Recently updated'],
  ['-priority', 'Priority: high → low'],
  ['priority', 'Priority: low → high'],
];

export default function Tickets() {
  const { isAdmin } = useAuth();
  // Filters live in the URL so a filtered view can be bookmarked or shared.
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get('q') || '',
    status: params.get('status') || '',
    priority: params.get('priority') || '',
    category: params.get('category') || '',
    assignedTo: params.get('assignedTo') || '',
    sort: params.get('sort') || '-createdAt',
    page: Number(params.get('page')) || 1,
  };
  const [search, setSearch] = useState(filters.q);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const key = params.toString();
  useEffect(() => {
    setError(null);
    api.listTickets({ ...filters, limit: 10 }).then(setResult).catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Debounced search box.
  useEffect(() => {
    if (search === filters.q) return;
    const t = setTimeout(() => update({ q: search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function update(patch) {
    const next = { ...filters, page: 1, ...patch };
    const clean = Object.fromEntries(
      Object.entries(next).filter(([k, v]) => v && !(k === 'sort' && v === '-createdAt') && !(k === 'page' && v === 1))
    );
    setParams(clean);
  }

  const hasFilters = filters.q || filters.status || filters.priority || filters.category || filters.assignedTo;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isAdmin ? 'All tickets' : 'My tickets'}</h1>
          {result && <p className="muted">{result.pagination.total} ticket{result.pagination.total === 1 ? '' : 's'}</p>}
        </div>
        <Link to="/tickets/new" className="btn primary">New ticket</Link>
      </div>

      <div className="card filters">
        <input
          type="search"
          placeholder="Search title, description or TCK number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tickets"
        />
        <Select value={filters.status} onChange={(v) => update({ status: v })} options={STATUSES} placeholder="All statuses" aria-label="Status" />
        <Select value={filters.priority} onChange={(v) => update({ priority: v })} options={PRIORITIES} placeholder="All priorities" aria-label="Priority" />
        <Select value={filters.category} onChange={(v) => update({ category: v })} options={CATEGORIES} placeholder="All categories" aria-label="Category" />
        {isAdmin && (
          <select value={filters.assignedTo} onChange={(e) => update({ assignedTo: e.target.value })} aria-label="Assignee">
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
          </select>
        )}
        <select value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {hasFilters && (
          <button className="btn ghost sm" onClick={() => { setSearch(''); setParams({}); }}>
            Clear
          </button>
        )}
      </div>

      <ErrorBox error={error} />

      {!result ? (
        <p className="muted">Loading…</p>
      ) : result.data.length === 0 ? (
        <div className="card empty">
          <p>No tickets match.</p>
          {!hasFilters && <Link to="/tickets/new" className="btn primary">Raise a ticket</Link>}
        </div>
      ) : (
        <div className="card flush">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Status</th>
                <th>Priority</th>
                <th className="hide-sm">Category</th>
                {isAdmin && <th className="hide-sm">Requester</th>}
                {isAdmin && <th className="hide-sm">Assignee</th>}
                <th className="hide-sm">Updated</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((t) => (
                <tr key={t._id}>
                  <td>
                    <Link to={`/tickets/${t._id}`} className="ticket-link">
                      <span className="muted small">
                        <span className="mono">{t.ticketNumber}</span>
                        {t.commentCount > 0 && ` · ${t.commentCount} comment${t.commentCount === 1 ? '' : 's'}`}
                      </span>
                      <span>{t.title}</span>
                    </Link>
                  </td>
                  <td><Badge kind="status" value={t.status} /></td>
                  <td><Badge kind="priority" value={t.priority} /></td>
                  <td className="hide-sm">{label(t.category)}</td>
                  {isAdmin && <td className="hide-sm">{t.createdBy?.name}</td>}
                  {isAdmin && <td className="hide-sm">{t.assignedTo?.name || <span className="muted">—</span>}</td>}
                  <td className="hide-sm muted small">{timeAgo(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && result.pagination.totalPages > 1 && (
        <div className="pager">
          <button className="btn ghost sm" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>
            ← Prev
          </button>
          <span className="muted small">Page {result.pagination.page} of {result.pagination.totalPages}</span>
          <button
            className="btn ghost sm"
            disabled={filters.page >= result.pagination.totalPages}
            onClick={() => update({ page: filters.page + 1 })}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
