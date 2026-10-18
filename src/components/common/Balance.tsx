import { CURRENCY, money } from '../../utils';

interface BalanceProps {
  value: number;
}

export default function Balance({ value }: BalanceProps) {
  if (Math.abs(value) < 0.5) return <span>Settled</span>;

  return (
    <span className={value > 0 ? 'ok' : 'bad'}>
      {value > 0 ? 'To receive ' : 'To pay '}
      {CURRENCY} {money(Math.abs(value))}
    </span>
  );
}
