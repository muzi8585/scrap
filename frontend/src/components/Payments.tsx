import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PAYMENT_MODES, money, today } from '../utils';
import type { Direction, InputChange, Party, Payment } from '../types';
import Field from './common/Field';
import DataTable from './common/DataTable';
import DownloadButton from './common/DownloadButton';

interface PaymentForm {
  date: string;
  party_id: string;
  direction: Direction;
  amount: string;
  mode: string;
  note: string;
}

const emptyForm: PaymentForm = { date: today(), party_id: '', direction: 'in', amount: '', mode: 'Cash', note: '' };

export default function Payments() {
  const payments = useFetch<Payment[]>('/payments');
  const parties = useFetch<Party[]>('/parties');
  const [form, setForm] = useState<PaymentForm>(emptyForm);

  const change = (key: keyof PaymentForm) => (e: InputChange) => setForm({ ...form, [key]: e.target.value });

  const save = () =>
    api
      .post('/payments', form)
      .then(() => {
        setForm({ ...emptyForm, date: form.date, direction: form.direction });
        payments.reload();
      })
      .catch((e: Error) => alert(e.message));

  const remove = (id: number) => api.remove('/payments/' + id).then(payments.reload);

  return (
    <div>
      <div className="card">
        <b>New payment</b>
        <div className="grid">
          <Field label="Date"><input type="date" value={form.date} onChange={change('date')} /></Field>
          <Field label="Party">
            <select value={form.party_id} onChange={change('party_id')}>
              <option value="">Select party</option>
              {(parties.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Direction">
            <select value={form.direction} onChange={change('direction')}>
              <option value="in">Received from party</option>
              <option value="out">Paid to party</option>
            </select>
          </Field>
          <Field label="Amount"><input type="number" step="any" value={form.amount} onChange={change('amount')} /></Field>
          <Field label="Mode">
            <select value={form.mode} onChange={change('mode')}>
              {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Note"><input value={form.note} onChange={change('note')} /></Field>
        </div>
        <button className="btn pri" onClick={save}>Save payment</button>
      </div>

      <div className="card">
        <div className="row">
          <b>Payment records</b>
          <span style={{ display: 'flex', gap: 8 }}>
            <DownloadButton path="/export/payments" filename="payments.xlsx">Export Excel</DownloadButton>
            <DownloadButton path="/export-pdf/payments" filename="payments.pdf">Export PDF</DownloadButton>
          </span>
        </div>
        <DataTable
          rows={payments.data}
          onDelete={remove}
          columns={[
            { title: 'Date', render: (p) => p.date },
            { title: 'Party', render: (p) => p.party.name },
            { title: 'Direction', render: (p) => <b className={p.direction === 'in' ? 'ok' : 'bad'}>{p.direction === 'in' ? 'Received' : 'Paid'}</b> },
            { title: 'Mode', render: (p) => p.mode },
            { title: 'Note', render: (p) => p.note },
            { title: 'Amount', right: true, render: (p) => money(p.amount) },
          ]}
        />
      </div>
    </div>
  );
}
