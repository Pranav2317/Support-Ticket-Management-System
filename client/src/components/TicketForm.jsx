import { useState } from 'react';
import { CATEGORIES, ErrorBox, PRIORITIES, Select } from './ui';

export default function TicketForm({ initial, onSubmit, onCancel, error, submitLabel = 'Save' }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    category: initial?.category || 'general',
    priority: initial?.priority || 'medium',
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form">
      <ErrorBox error={error} />
      <label>
        Title
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Short summary of the issue"
          required
          minLength={5}
          maxLength={120}
        />
      </label>
      <label>
        Description
        <textarea
          rows={6}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What happened? What did you expect? Steps to reproduce…"
          required
          minLength={10}
          maxLength={5000}
        />
      </label>
      <div className="grid-2">
        <label>
          Category
          <Select value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={CATEGORIES} />
        </label>
        <label>
          Priority
          <Select value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={PRIORITIES} />
        </label>
      </div>
      <div className="actions">
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        )}
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
