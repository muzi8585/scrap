import type { Column } from '../../types';

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | null;
  onDelete?: (id: number) => void;
}

export default function DataTable<T extends { id: number }>({ columns, rows, onDelete }: DataTableProps<T>) {
  if (!rows) return <div className="empty">Loading...</div>;
  if (rows.length === 0) return <div className="empty">Nothing here yet.</div>;

  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.title} className={c.right ? 'r' : ''}>{c.title}</th>
            ))}
            {onDelete && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.title} className={c.right ? 'r' : ''}>{c.render(row)}</td>
              ))}
              {onDelete && (
                <td>
                  <button
                    className="btn sm del"
                    onClick={() => window.confirm('Delete this record?') && onDelete(row.id)}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
