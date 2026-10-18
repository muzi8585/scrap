import { useFetch } from '../hooks/useFetch';
import { money } from '../utils';
import type { Statement } from '../types';
import Balance from './common/Balance';
import DownloadButton from './common/DownloadButton';

interface PartyStatementProps {
  id: number;
  onBack: () => void;
}

export default function PartyStatement({ id, onBack }: PartyStatementProps) {
  const { data, error } = useFetch<Statement>(`/parties/${id}/statement`);

  if (error) return <p className="bad">{error}</p>;
  if (!data) return <div className="empty">Loading...</div>;

  return (
    <div className="card">
      <div className="row">
        <div>
          <b>{data.party.name}</b>
          <br />
          <Balance value={data.balance} />
        </div>
        <div className="row">
          <button className="btn" onClick={onBack}>Back</button>
          <DownloadButton path={`/parties/${id}/statement-pdf`} filename={`statement-${data.party.name}.pdf`} primary>
            Download PDF
          </DownloadButton>
        </div>
      </div>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Details</th>
              <th className="r">Debit</th>
              <th className="r">Credit</th>
              <th className="r">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                <td>{row.date}</td>
                <td>{row.details}</td>
                <td className="r">{row.debit ? money(row.debit) : ''}</td>
                <td className="r">{row.credit ? money(row.credit) : ''}</td>
                <td className="r">{money(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small>Debit = party owes you. Credit = you owe the party.</small>
    </div>
  );
}
