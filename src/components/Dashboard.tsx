import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { CURRENCY, money, tons } from '../utils';
import type { DashboardData } from '../types';
import StatCard from './common/StatCard';
import Balance from './common/Balance';

export default function Dashboard() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, error } = useFetch<DashboardData>(`/dashboard?from=${from}&to=${to}`);

  if (error) return <p className="bad">{error}</p>;
  if (!data) return <div className="empty">Loading...</div>;

  const cur = (value: number) => `${CURRENCY} ${money(value)}`;

  return (
    <div>
      <div className="card row">
        <b>Period</b>
        <div className="row">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn sm" onClick={() => { setFrom(''); setTo(''); }}>All time</button>
        </div>
      </div>

      <div className="grid">
        <StatCard label="Stock in (tons)" value={tons(data.kg_in)} />
        <StatCard label="Stock out (tons)" value={tons(data.kg_out)} />
        <StatCard label="Stock in hand (tons, all time)" value={tons(data.stock_in_hand_kg)} />
        <StatCard label="Purchases" value={cur(data.purchases)} />
        <StatCard label="Sales" value={cur(data.sales)} />
        <StatCard label="All expenses" value={cur(data.expenses)} />
        <StatCard label="Labour paid" value={cur(data.labour)} />
        <StatCard label="Net cash flow" value={cur(data.cash_flow)} tone={data.cash_flow < 0 ? 'bad' : 'ok'} />
        <StatCard label="Pending to receive" value={cur(data.receivable)} tone="ok" />
        <StatCard label="Pending to pay" value={cur(data.payable)} tone="bad" />
        <StatCard label="Profit (sales - purchases - expenses)" value={cur(data.profit)} tone={data.profit < 0 ? 'bad' : 'ok'} />
      </div>
      <small>Profit does not include the value of unsold stock.</small>

      <div className="card" style={{ marginTop: 14 }}>
        <b>Pending payments</b>
        {data.pending.length === 0 && <div className="empty">No pending balances.</div>}
        <table>
          <tbody>
            {data.pending.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="r"><Balance value={p.balance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
