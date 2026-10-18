import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks/useFetch';
import { CURRENCY, EXPENSE_CATEGORIES, money, num, today } from '../utils';
import type { Expense, InputChange, Vehicle } from '../types';
import Field from './common/Field';
import DataTable from './common/DataTable';
import DownloadButton from './common/DownloadButton';

interface ExpenseForm {
  date: string;
  category: string;
  paid_to: string;
  vehicle_id: string;
  details: string;
  amount: string;
}

const emptyForm: ExpenseForm = { date: today(), category: 'Labour', paid_to: '', vehicle_id: '', details: '', amount: '' };

export default function Expenses() {
  const expenses = useFetch<Expense[]>('/expenses');
  const vehicles = useFetch<Vehicle[]>('/vehicles');
  const [form, setForm] = useState<ExpenseForm>(emptyForm);

  const change = (key: keyof ExpenseForm) => (e: InputChange) => setForm({ ...form, [key]: e.target.value });

  const save = () =>
    api
      .post('/expenses', { ...form, vehicle_id: form.vehicle_id || null })
      .then(() => {
        setForm({ ...emptyForm, date: form.date, category: form.category });
        expenses.reload();
      })
      .catch((e: Error) => alert(e.message));

  const remove = (id: number) => api.remove('/expenses/' + id).then(expenses.reload);

  const totals: Record<string, number> = {};
  (expenses.data || []).forEach((x) => {
    totals[x.category] = (totals[x.category] || 0) + num(x.amount);
  });

  return (
    <div>
      <div className="card">
        <b>New expense (labour, transport, vehicles, other)</b>
        <div className="grid">
          <Field label="Date"><input type="date" value={form.date} onChange={change('date')} /></Field>
          <Field label="Category">
            <select value={form.category} onChange={change('category')}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Paid to (worker / driver)"><input value={form.paid_to} onChange={change('paid_to')} /></Field>
          <Field label="Vehicle">
            <select value={form.vehicle_id} onChange={change('vehicle_id')}>
              <option value="">No vehicle</option>
              {(vehicles.data || []).map((v) => <option key={v.id} value={v.id}>{v.number}</option>)}
            </select>
          </Field>
          <Field label="Details"><input value={form.details} onChange={change('details')} /></Field>
          <Field label="Amount"><input type="number" step="any" value={form.amount} onChange={change('amount')} /></Field>
        </div>
        <p className="muted">
          {Object.keys(totals).length
            ? Object.keys(totals).map((c) => `${c}: ${CURRENCY} ${money(totals[c])}`).join('  |  ')
            : 'Totals by category appear here.'}
        </p>
        <button className="btn pri" onClick={save}>Save expense</button>
      </div>

      <div className="card">
        <div className="row">
          <b>Expense records</b>
          <span style={{ display: 'flex', gap: 8 }}>
            <DownloadButton path="/export/expenses" filename="expenses.xlsx">Export Excel</DownloadButton>
            <DownloadButton path="/export-pdf/expenses" filename="expenses.pdf">Export PDF</DownloadButton>
          </span>
        </div>
        <DataTable
          rows={expenses.data}
          onDelete={remove}
          columns={[
            { title: 'Date', render: (x) => x.date },
            { title: 'Category', render: (x) => x.category },
            { title: 'Paid to', render: (x) => x.paid_to },
            { title: 'Vehicle', render: (x) => (x.vehicle ? x.vehicle.number : '') },
            { title: 'Details', render: (x) => x.details },
            { title: 'Amount', right: true, render: (x) => money(x.amount) },
          ]}
        />
      </div>
    </div>
  );
}
