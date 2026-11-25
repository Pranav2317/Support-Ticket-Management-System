import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import TicketForm from '../components/TicketForm';
import { Badge, ErrorBox, label, PRIORITIES, STATUS_TRANSITIONS, timeAgo } from '../components/ui';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [tab, setTab] = useState('comments');
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, c, a] = await Promise.all([api.getTicket(id), api.listComments(id), api.activity(id)]);
      setTicket(t.data);
      setComments(c.data);
      setActivity(a.data);
    } catch (err) {
      setLoadError(err);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) api.admins().then((r) => setAdmins(r.data)).catch(() => {});
  }, [isAdmin]);

  // Run a mutation, surface errors inline, then refresh ticket + comments + activity.
  const run = async (fn) => {
    setError(null);
    try {
      await fn();
      await load();
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  };

  if (loadError) {
    return (
      <div className="card empty">
        <p>{loadError.status === 404 ? 'Ticket not found.' : loadError.message}</p>
        <Link to="/tickets" className="btn ghost">Back to tickets</Link>
      </div>
    );
  }
  if (!ticket) return <p className="muted">Loading…</p>;

  const isOwner = ticket.createdBy?._id === user._id;
  const canEdit = isAdmin || (isOwner && ticket.status === 'open');
  const canComment = isAdmin || ticket.status !== 'closed';

  const remove = async () => {
    if (!window.confirm(`Delete ${ticket.ticketNumber}? This also deletes its comments.`)) return;
    try {
      await api.deleteTicket(id);
      navigate('/tickets');
    } catch (err) {
      setError(err);
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    if (await run(() => api.addComment(id, comment))) setComment('');
  };

  return (
    <>
      <Link to="/tickets" className="back small">← Back to tickets</Link>

      <div className="page-head">
        <div>
          <p className="mono muted small">{ticket.ticketNumber}</p>
          <h1>{ticket.title}</h1>
          <div className="badges">
            <Badge kind="status" value={ticket.status} />
            <Badge kind="priority" value={ticket.priority} />
            <span className="chip">{label(ticket.category)}</span>
          </div>
        </div>
        <div className="actions">
          {canEdit && !editing && (
            <button className="btn ghost" onClick={() => setEditing(true)}>Edit</button>
          )}
          {canEdit && (
            <button className="btn danger" onClick={remove}>Delete</button>
          )}
        </div>
      </div>

      <ErrorBox error={error} />
      {isOwner && !isAdmin && ticket.status !== 'open' && (
        <p className="hint">This ticket is being handled by support, so it can no longer be edited. You can still add comments{ticket.status === 'closed' ? ' once it is reopened' : ''}.</p>
      )}

      <div className="detail">
        <div className="detail-main">
          <div className="card">
            {editing ? (
              <TicketForm
                initial={ticket}
                error={null}
                onCancel={() => setEditing(false)}
                onSubmit={async (data) => {
                  if (await run(() => api.updateTicket(id, data))) setEditing(false);
                }}
              />
            ) : (
              <p className="description">{ticket.description}</p>
            )}
          </div>

          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'comments'} className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}>
              Comments ({comments.length})
            </button>
            <button role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
              Activity ({activity.length})
            </button>
          </div>

          {tab === 'comments' ? (
            <div className="card">
              {comments.length === 0 && <p className="muted">No comments yet.</p>}
              <ul className="comments">
                {comments.map((c) => (
                  <li key={c._id} className={c.author?.role === 'admin' ? 'staff' : ''}>
                    <div className="comment-head">
                      <strong>{c.author?.name || 'Deleted user'}</strong>
                      {c.author?.role === 'admin' && <span className="role role-admin">support</span>}
                      <span className="muted small">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p>{c.body}</p>
                  </li>
                ))}
              </ul>
              {canComment ? (
                <form onSubmit={postComment} className="comment-form">
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={isAdmin ? 'Reply to the customer…' : 'Add a comment…'}
                    maxLength={2000}
                    aria-label="Comment"
                  />
                  <div className="actions">
                    <button className="btn primary" disabled={!comment.trim()}>Post comment</button>
                  </div>
                </form>
              ) : (
                <p className="muted small">This ticket is closed.</p>
              )}
            </div>
          ) : (
            <div className="card">
              <ol className="timeline">
                {activity.map((a) => (
                  <li key={a._id}>
                    <span className={`tl-dot ev-${a.event.split('.')[1]}`} />
                    <div>
                      <p>{a.message}</p>
                      <small className="muted">{new Date(a.createdAt).toLocaleString()}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <aside className="detail-side">
          <div className="card meta">
            <dl>
              <dt>Requester</dt>
              <dd>{ticket.createdBy?.name}{isAdmin && <span className="muted small block">{ticket.createdBy?.email}</span>}</dd>
              <dt>Assignee</dt>
              <dd>{ticket.assignedTo?.name || <span className="muted">Unassigned</span>}</dd>
              <dt>Created</dt>
              <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
              <dt>Last updated</dt>
              <dd>{timeAgo(ticket.updatedAt)}</dd>
              {ticket.resolvedAt && (
                <>
                  <dt>Resolved</dt>
                  <dd>{new Date(ticket.resolvedAt).toLocaleString()}</dd>
                </>
              )}
            </dl>
          </div>

          {isAdmin && (
            <div className="card admin-panel">
              <h3>Manage</h3>
              <label>
                Status
                <select value={ticket.status} onChange={(e) => run(() => api.updateStatus(id, e.target.value))}>
                  <option value={ticket.status}>{label(ticket.status)}</option>
                  {STATUS_TRANSITIONS[ticket.status].map((s) => (
                    <option key={s} value={s}>→ {label(s)}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select value={ticket.priority} onChange={(e) => run(() => api.updateTicket(id, { priority: e.target.value }))}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{label(p)}</option>
                  ))}
                </select>
              </label>
              <label>
                Assignee
                <select
                  value={ticket.assignedTo?._id || ''}
                  onChange={(e) => run(() => api.assignTicket(id, e.target.value || null))}
                >
                  <option value="">Unassigned</option>
                  {admins.map((a) => (
                    <option key={a._id} value={a._id}>{a._id === user._id ? `${a.name} (me)` : a.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
