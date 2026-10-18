import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks/useFetch';
import { CURRENCY, money, tons } from '../utils';
import type { Vehicle } from '../types';
import Field from './common/Field';
import DataTable from './common/DataTable';
import DownloadButton from './common/DownloadButton';

const emptyForm = { number: '', driver: '' };

export default function Vehicles() {
  const vehicles = useFetch<Vehicle[]>('/vehicles');
  const [form, setForm] = useState(emptyForm);

  const save = () =>
    api
      .post('/vehicles', form)
      .then(() => {
        setForm(emptyForm);
        vehicles.reload();
      })
      .catch((e: Error) => alert(e.message));

  const remove = (id: number) => api.remove('/vehicles/' + id).then(vehicles.reload);

  return (
    <div>
      <div className="card">
        <b>Add vehicle</b>
        <div className="grid">
          <Field label="Vehicle number"><input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
          <Field label="Driver"><input value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} /></Field>
        </div>
        <button className="btn pri" onClick={save}>Add vehicle</button>
      </div>

      <div className="card">
        <div className="row">
          <b>Vehicles</b>
          <DownloadButton path="/export-pdf/vehicles" filename="vehicles.pdf">Export PDF</DownloadButton>
        </div>
        <DataTable
          rows={vehicles.data}
          onDelete={remove}
          columns={[
            { title: 'Vehicle', render: (v) => v.number },
            { title: 'Driver', render: (v) => v.driver },
            { title: 'Trips', right: true, render: (v) => v.trips },
            { title: 'Tons received', right: true, render: (v) => tons(v.kg_in) },
            { title: 'Tons sent', right: true, render: (v) => tons(v.kg_out) },
            { title: 'Expenses', right: true, render: (v) => `${CURRENCY} ${money(v.expenses)}` },
          ]}
        />
      </div>
    </div>
  );
}
