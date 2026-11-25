import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, ErrorBox, label, PRIORITIES, STATUSES, timeAgo } from '../components/ui';

function Bars({ title, data, keys, kind }) {
  const max = Math.max(1, ...keys.map((k) => data[k] || 0));
  return (
    <div className="card">
      <h3>{title}</h3>
      <ul className="bars">
        {keys.map((k) => (
          <li key={k}>
            <span className="bar-label">{label(k)}</span>
            <span className="bar-track">
              <span className={`bar-fill ${kind}-${k}`} style={{ width: `${((data[k] || 0) / max) * 100}%` }} />
            </span>
            <span className="bar-value">{data[k] || 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.stats(), api.listTickets({ limit: 5, sort: '-updatedAt' })])
      .then(([s, t]) => {
        setStats(s.data);
        setRecent(t.data);
      })
      .catch(setError);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!stats) return <p className="muted">Loading…</p>;

  const active = stats.byStatus.open + stats.byStatus.in_progress;
  const tiles = [
    { label: 'Total tickets', value: stats.total },
    { label: 'Active', value: active },
    { label: 'Resolved', value: stats.byStatus.resolved + stats.byStatus.closed },
    isAdmin
      ? { label: 'Unassigned (active)', value: stats.unassigned }
      : { label: 'Urgent', value: stats.byPriority.urgent },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi, {user.name.split(' ')[0]}</h1>
          <p className="muted">
            {isAdmin ? 'Overview of every ticket in the helpdesk.' : 'Overview of the tickets you have raised.'}
            {stats.avgResolutionHours !== null &&
              ` Average resolution time: ${stats.avgResolutionHours < 1 ? 'under 1h' : `${stats.avgResolutionHours}h`}.`}
          </p>
        </div>
        <Link to="/tickets/new" className="btn primary">New ticket</Link>
      </div>

      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className="card tile">
            <span className="tile-value">{t.value}</span>
            <span className="muted small">{t.label}</span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Bars title="By status" data={stats.byStatus} keys={STATUSES} kind="status" />
        <Bars title="By priority" data={stats.byPriority} keys={PRIORITIES} kind="priority" />
      </div>

      <div className="card">
        <div className="row-between">
          <h3>Recently updated</h3>
          <Link to="/tickets" className="small">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted">No tickets yet. <Link to="/tickets/new">Raise your first one.</Link></p>
        ) : (
          <ul className="recent">
            {recent.map((t) => (
              <li key={t._id}>
                <Link to={`/tickets/${t._id}`}>
                  <span className="mono muted">{t.ticketNumber}</span>
                  <span className="recent-title">{t.title}</span>
                  <Badge kind="status" value={t.status} />
                  <span className="muted small">{timeAgo(t.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
