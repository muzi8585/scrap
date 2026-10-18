export const CURRENCY = 'Rs';

export const EXPENSE_CATEGORIES = [
  'Labour',
  'Loading/Unloading',
  'Transport/Freight',
  'Vehicle fuel',
  'Vehicle repair',
  'Rent',
  'Electricity',
  'Other',
];

export const PAYMENT_MODES = ['Cash', 'Bank', 'Cheque', 'Online'];

type Numeric = string | number | null | undefined;

export const num = (value: Numeric): number => parseFloat(String(value)) || 0;

export const today = (): string => new Date().toISOString().slice(0, 10);

export const money = (value: Numeric): string => Math.round(num(value)).toLocaleString();

export const price = (value: Numeric): string =>
  num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const tons = (kg: Numeric): string =>
  (num(kg) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });
