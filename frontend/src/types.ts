import type { ChangeEvent, ReactNode } from 'react';

export type Direction = 'in' | 'out';

export type InputChange = ChangeEvent<HTMLInputElement | HTMLSelectElement>;

export interface NamedRef {
  id: number;
  name: string;
}

export interface VehicleRef {
  id: number;
  number: string;
}

export interface Party {
  id: number;
  name: string;
  phone: string | null;
  kg_in: number;
  kg_out: number;
  balance: number;
}

export interface Vehicle {
  id: number;
  number: string;
  driver: string | null;
  trips: number;
  kg_in: number;
  kg_out: number;
  expenses: number;
}

export interface Rate {
  id: number;
  date: string;
  buy: number;
  sell: number;
}

export interface CurrentRate {
  buy: number;
  sell: number;
}

export interface StockEntry {
  id: number;
  date: string;
  type: Direction;
  party: NamedRef;
  vehicle: VehicleRef | null;
  kg: number;
  rate: number;
  amount: number;
  paid: number;
}

export interface Payment {
  id: number;
  date: string;
  party: NamedRef;
  direction: Direction;
  amount: number;
  mode: string;
  note: string | null;
}

export interface Expense {
  id: number;
  date: string;
  category: string;
  paid_to: string | null;
  vehicle: VehicleRef | null;
  details: string | null;
  amount: number;
}

export interface StatementRow {
  date: string;
  details: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface Statement {
  party: { id: number; name: string; phone: string | null };
  balance: number;
  rows: StatementRow[];
}

export interface PendingParty {
  id: number;
  name: string;
  balance: number;
}

export interface DashboardData {
  kg_in: number;
  kg_out: number;
  stock_in_hand_kg: number;
  purchases: number;
  sales: number;
  expenses: number;
  labour: number;
  cash_flow: number;
  receivable: number;
  payable: number;
  profit: number;
  pending: PendingParty[];
}

export interface Column<T> {
  title: string;
  right?: boolean;
  render: (row: T) => ReactNode;
}
