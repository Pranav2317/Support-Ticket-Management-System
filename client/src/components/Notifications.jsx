import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { timeAgo } from './ui';

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const load = useCallback(() => {
    api
      .notifications({ limit: 8 })
      .then((r) => {
        setItems(r.data);
        setUnread(r.unreadCount);
      })
      .catch(() => {});
  }, []);

  // Refresh on navigation and every 30s (simple polling keeps the backend stateless).
  useEffect(load, [load, location.pathname]);
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const openItem = async (n) => {
    if (!n.read) await api.markRead(n._id).catch(() => {});
    setOpen(false);
    load();
    if (n.ticket) navigate(`/tickets/${n.ticket._id}`);
  };

  const readAll = async () => {
    await api.markAllRead();
    load();
  };

  return (
    <div className="notif" ref={ref}>
      <button className="icon-btn" aria-label={`Notifications (${unread} unread)`} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link" onClick={readAll}>Mark all read</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="muted pad">You're all caught up.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n._id} className={n.read ? '' : 'unread'}>
                  <button onClick={() => openItem(n)}>
                    <span>{n.message}</span>
                    <small className="muted">{timeAgo(n.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
