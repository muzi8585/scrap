import { useEffect, useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks/useFetch';
import { CURRENCY, money, num, price, tons, today } from '../utils';
import type { CurrentRate, Direction, InputChange, Party, StockEntry, Vehicle } from '../types';
import Field from './common/Field';
import DataTable from './common/DataTable';
import DownloadButton from './common/DownloadButton';

interface StockForm {
  date: string;
  type: Direction;
  party_id: string;
  vehicle_id: string;
  kg: string;
  rate: string;
  paid: string;
}

const emptyForm: StockForm = { date: today(), type: 'in', party_id: '', vehicle_id: '', kg: '', rate: '', paid: '' };

export default function StockEntries() {
  const stock = useFetch<StockEntry[]>('/stock');
  const parties = useFetch<Party[]>('/parties');
  const vehicles = useFetch<Vehicle[]>('/vehicles');
  const currentRate = useFetch<CurrentRate>('/rates/current');
  const [form, setForm] = useState<StockForm>(emptyForm);

  const rateFor = (type: Direction): string => {
    const value = currentRate.data ? currentRate.data[type === 'in' ? 'buy' : 'sell'] : 0;
    return value ? String(value) : '';
  };

  useEffect(() => {
    if (currentRate.data) setForm((f) => (f.rate === '' ? { ...f, rate: rateFor(f.type) } : f));
  }, [currentRate.data]);

  const change = (key: keyof StockForm) => (e: InputChange) => setForm({ ...form, [key]: e.target.value });

  const changeType = (e: InputChange) => {
    const type = e.target.value as Direction;
    setForm({ ...form, type, rate: rateFor(type) });
  };

  const save = () =>
    api
      .post('/stock', { ...form, vehicle_id: form.vehicle_id || null })
      .then(() => {
        setForm({ ...emptyForm, date: form.date, type: form.type, rate: rateFor(form.type) });
        stock.reload();
      })
      .catch((e: Error) => alert(e.message));

  const remove = (id: number) => api.remove('/stock/' + id).then(stock.reload);

  const amount = num(form.kg) * num(form.rate);

  return (
    <div>
      <div className="card">
        <b>New stock entry</b>
        <div className="grid">
          <Field label="Date"><input type="date" value={form.date} onChange={change('date')} /></Field>
          <Field label="Type">
            <select value={form.type} onChange={changeType}>
              <option value="in">Incoming (bought)</option>
              <option value="out">Outgoing (sold / sent)</option>
            </select>
          </Field>
          <Field label="Party / mill">
            <select value={form.party_id} onChange={change('party_id')}>
              <option value="">Select party</option>
              {(parties.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Vehicle">
            <select value={form.vehicle_id} onChange={change('vehicle_id')}>
              <option value="">No vehicle</option>
              {(vehicles.data || []).map((v) => <option key={v.id} value={v.id}>{v.number}</option>)}
            </select>
          </Field>
          <Field label="Weight (kg)"><input type="number" step="any" value={form.kg} onChange={change('kg')} /></Field>
          <Field label="Rate per kg"><input type="number" step="any" value={form.rate} onChange={change('rate')} /></Field>
          <Field label="Paid / received now"><input type="number" step="any" value={form.paid} onChange={change('paid')} /></Field>
        </div>
        <p>
          {tons(form.kg)} tons | Amount <b>{CURRENCY} {money(amount)}</b> | Pending{' '}
          <b className="warn">{CURRENCY} {money(amount - num(form.paid))}</b>
        </p>
        <button className="btn pri" onClick={save}>Save entry</button>
      </div>

      <div className="card">
        <div className="row">
          <b>Stock records</b>
          <span style={{ display: 'flex', gap: 8 }}>
            <DownloadButton path="/export/stock" filename="stock.xlsx">Export Excel</DownloadButton>
            <DownloadButton path="/export-pdf/stock" filename="stock.pdf">PDF all</DownloadButton>
            <DownloadButton path="/export-pdf/stock?type=in" filename="stock-in.pdf">PDF incoming</DownloadButton>
            <DownloadButton path="/export-pdf/stock?type=out" filename="stock-out.pdf">PDF outgoing</DownloadButton>
          </span>
        </div>
        <DataTable
          rows={stock.data}
          onDelete={remove}
          columns={[
            { title: 'Date', render: (e) => e.date },
            { title: 'Type', render: (e) => <b className={e.type === 'in' ? 'ok' : 'warn'}>{e.type === 'in' ? 'IN' : 'OUT'}</b> },
            { title: 'Party', render: (e) => e.party.name },
            { title: 'Vehicle', render: (e) => (e.vehicle ? e.vehicle.number : '') },
            { title: 'Kg', right: true, render: (e) => money(e.kg) },
            { title: 'Tons', right: true, render: (e) => tons(e.kg) },
            { title: 'Rate', right: true, render: (e) => price(e.rate) },
            { title: 'Amount', right: true, render: (e) => money(e.amount) },
            { title: 'Paid', right: true, render: (e) => money(e.paid) },
            { title: 'Pending', right: true, render: (e) => money(e.amount - e.paid) },
          ]}
        />
      </div>
    </div>
  );
}
