import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks/useFetch';
import { tons } from '../utils';
import type { Party } from '../types';
import Field from './common/Field';
import DataTable from './common/DataTable';
import Balance from './common/Balance';
import DownloadButton from './common/DownloadButton';

interface PartiesProps {
  onOpen: (id: number) => void;
}

const emptyForm = { name: '', phone: '' };

export default function Parties({ onOpen }: PartiesProps) {
  const parties = useFetch<Party[]>('/parties');
  const [form, setForm] = useState(emptyForm);

  const save = () =>
    api
      .post('/parties', form)
      .then(() => {
        setForm(emptyForm);
        parties.reload();
      })
      .catch((e: Error) => alert(e.message));

  const remove = (id: number) =>
    api
      .remove('/parties/' + id)
      .then(parties.reload)
      .catch((e: Error) => alert(e.message));

  return (
    <div>
      <div className="card">
        <b>Add party (supplier, mill or buyer)</b>
        <div className="grid">
          <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <button className="btn pri" onClick={save}>Add party</button>
      </div>

      <div className="card">
        <div className="row">
          <b>Parties</b>
          <span style={{ display: 'flex', gap: 8 }}>
            <DownloadButton path="/export/parties" filename="parties.xlsx">Export Excel</DownloadButton>
            <DownloadButton path="/export-pdf/parties" filename="parties.pdf">Export PDF</DownloadButton>
          </span>
        </div>
        <DataTable
          rows={parties.data}
          onDelete={remove}
          columns={[
            { title: 'Party', render: (p) => p.name },
            { title: 'Phone', render: (p) => p.phone },
            { title: 'Tons in', right: true, render: (p) => tons(p.kg_in) },
            { title: 'Tons out', right: true, render: (p) => tons(p.kg_out) },
            { title: 'Balance', right: true, render: (p) => <Balance value={p.balance} /> },
            { title: 'Statement', render: (p) => <button className="btn sm" onClick={() => onOpen(p.id)}>Open</button> },
          ]}
        />
      </div>
    </div>
  );
}
