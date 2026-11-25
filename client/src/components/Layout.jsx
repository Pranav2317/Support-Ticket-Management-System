import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Notifications from './Notifications';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden>◆</span> Helpdesk
          </NavLink>
          <nav className="nav">
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/tickets" end>{isAdmin ? 'All tickets' : 'My tickets'}</NavLink>
            <NavLink to="/tickets/new">New ticket</NavLink>
          </nav>
          <div className="topbar-right">
            <Notifications />
            <div className="who">
              <span className="who-name">{user.name}</span>
              <span className={`role role-${user.role}`}>{user.role}</span>
            </div>
            <button className="btn ghost sm" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
