const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'helpdesk_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors || [];
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:logout'));
    }
    throw new ApiError(res.status, json.message || 'Request failed', json.errors);
  }
  return json;
}

const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null);
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

export const api = {
  register: (data) => request('POST', '/auth/register', data),
  login: (data) => request('POST', '/auth/login', data),
  me: () => request('GET', '/auth/me'),

  listTickets: (params) => request('GET', `/tickets${qs(params)}`),
  stats: () => request('GET', '/tickets/stats'),
  getTicket: (id) => request('GET', `/tickets/${id}`),
  createTicket: (data) => request('POST', '/tickets', data),
  updateTicket: (id, data) => request('PATCH', `/tickets/${id}`, data),
  updateStatus: (id, status) => request('PATCH', `/tickets/${id}/status`, { status }),
  assignTicket: (id, assignedTo) => request('PATCH', `/tickets/${id}/assign`, { assignedTo }),
  deleteTicket: (id) => request('DELETE', `/tickets/${id}`),

  listComments: (id) => request('GET', `/tickets/${id}/comments`),
  addComment: (id, body) => request('POST', `/tickets/${id}/comments`, { body }),
  activity: (id) => request('GET', `/tickets/${id}/activity`),

  notifications: (params) => request('GET', `/notifications${qs(params)}`),
  markRead: (id) => request('PATCH', `/notifications/${id}/read`),
  markAllRead: () => request('PATCH', '/notifications/read-all'),

  admins: () => request('GET', '/users/admins'),
};
