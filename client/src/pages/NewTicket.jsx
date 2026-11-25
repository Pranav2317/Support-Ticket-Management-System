import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import TicketForm from '../components/TicketForm';

export default function NewTicket() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const submit = async (data) => {
    setError(null);
    try {
      const r = await api.createTicket(data);
      navigate(`/tickets/${r.data._id}`);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New ticket</h1>
          <p className="muted">Describe the problem and our support team will get back to you.</p>
        </div>
      </div>
      <div className="card narrow">
        <TicketForm onSubmit={submit} error={error} submitLabel="Submit ticket" onCancel={() => navigate(-1)} />
      </div>
    </>
  );
}
