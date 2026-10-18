interface StatCardProps {
  label: string;
  value: string;
  tone?: 'ok' | 'bad' | 'warn' | '';
}

export default function StatCard({ label, value, tone = '' }: StatCardProps) {
  return (
    <div className="card stat">
      <small>{label}</small>
      <b className={tone}>{value}</b>
    </div>
  );
}
