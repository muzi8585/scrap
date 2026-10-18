import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks/useFetch';
import { price, today } from '../utils';
import type { InputChange, Rate } from '../types';
import Field from './common/Field';
import DataTable from './common/DataTable';
import DownloadButton from './common/DownloadButton';

interface RateForm {
  date: string;
  buy: string;
  sell: string;
}

export default function Rates() {
  const rates = useFetch<Rate[]>('/rates');
  const [form, setForm] = useState<RateForm>({ date: today(), buy: '', sell: '' });

  const change = (key: keyof RateForm) => (e: InputChange) => setForm({ ...form, [key]: e.target.value });

  const save = () =>
    api
      .post('/rates', form)
      .then(() => rates.reload())
      .catch((e: Error) => alert(e.message));

  const remove = (id: number) => api.remove('/rates/' + id).then(rates.reload);

  return (
    <div>
      <div className="card">
        <b>Today's rate per kg</b>
        <small style={{ display: 'block' }}>New stock entries use the latest rate. You can still change the rate on any single entry.</small>
        <div className="grid">
          <Field label="Date"><input type="date" value={form.date} onChange={change('date')} /></Field>
          <Field label="Buying rate / kg (incoming)"><input type="number" step="any" value={form.buy} onChange={change('buy')} /></Field>
          <Field label="Selling rate / kg (outgoing)"><input type="number" step="any" value={form.sell} onChange={change('sell')} /></Field>
        </div>
        <button className="btn pri" onClick={save}>Save rate</button>
      </div>

      <div className="card">
        <div className="row">
          <b>Rate history</b>
          <DownloadButton path="/export-pdf/rates" filename="rates.pdf">Export PDF</DownloadButton>
        </div>
        <DataTable
          rows={rates.data}
          onDelete={remove}
          columns={[
            { title: 'Date', render: (r) => r.date },
            { title: 'Buy / kg', right: true, render: (r) => price(r.buy) },
            { title: 'Sell / kg', right: true, render: (r) => price(r.sell) },
          ]}
        />
      </div>
    </div>
  );
}
