import type { Request } from 'express';
import { getDb } from './db.js';

export type Doc = Record<string, any>;

export const col = async (name: string) => (await getDb()).collection<Doc>(name);

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const toApi = (doc: Doc): Doc => {
  const { _id, created_at, ...rest } = doc;
  return { id: _id, ...rest };
};

export const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

export function dateRange(request: Request): Doc {
  const from = asText(request.query.from);
  const to = asText(request.query.to);
  const range: Doc = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return Object.keys(range).length ? { date: range } : {};
}

export async function nameMap(collection: string, field: string, docs: Doc[]): Promise<Map<number, string>> {
  const ids = [...new Set(docs.map((doc) => doc[field]).filter((id) => id != null))];
  const rows = ids.length ? await (await col(collection)).find({ _id: { $in: ids } }).toArray() : [];
  return new Map(rows.map((row) => [row._id as number, (row.name ?? row.number) as string]));
}

export async function withRefs(docs: Doc[], parties = true, vehicles = true) {
  const [partyNames, vehicleNames] = await Promise.all([
    parties ? nameMap('parties', 'party_id', docs) : Promise.resolve(new Map<number, string>()),
    vehicles ? nameMap('vehicles', 'vehicle_id', docs) : Promise.resolve(new Map<number, string>()),
  ]);

  return docs.map((doc) => {
    const out = toApi(doc);
    if (parties) out.party = { id: doc.party_id, name: partyNames.get(doc.party_id) ?? '' };
    if (vehicles) out.vehicle = doc.vehicle_id ? { id: doc.vehicle_id, number: vehicleNames.get(doc.vehicle_id) ?? '' } : null;
    return out;
  });
}

interface PartyTotals {
  kg_in: number;
  kg_out: number;
  sold: number;
  bought: number;
  received: number;
  paidOut: number;
}

export async function partyTotals(): Promise<Map<number, PartyTotals>> {
  const [stock, payments] = await Promise.all([
    (await col('stock_entries'))
      .aggregate([
        {
          $group: {
            _id: { p: '$party_id', t: '$type' },
            kg: { $sum: '$kg' },
            pending: { $sum: { $subtract: ['$amount', '$paid'] } },
          },
        },
      ])
      .toArray(),
    (await col('payments'))
      .aggregate([{ $group: { _id: { p: '$party_id', d: '$direction' }, amount: { $sum: '$amount' } } }])
      .toArray(),
  ]);

  const totals = new Map<number, PartyTotals>();
  const entry = (id: number): PartyTotals => {
    if (!totals.has(id)) totals.set(id, { kg_in: 0, kg_out: 0, sold: 0, bought: 0, received: 0, paidOut: 0 });
    return totals.get(id)!;
  };

  for (const row of stock) {
    const t = entry(row._id.p);
    if (row._id.t === 'out') {
      t.kg_out += row.kg;
      t.sold += row.pending;
    } else {
      t.kg_in += row.kg;
      t.bought += row.pending;
    }
  }

  for (const row of payments) {
    const t = entry(row._id.p);
    if (row._id.d === 'in') t.received += row.amount;
    else t.paidOut += row.amount;
  }

  return totals;
}

export const balanceOf = (t?: PartyTotals): number =>
  t ? round2(t.sold - t.bought - t.received + t.paidOut) : 0;

export async function partySummaries() {
  const [parties, totals] = await Promise.all([
    (await col('parties')).find().sort({ name: 1 }).toArray(),
    partyTotals(),
  ]);

  return parties.map((party) => {
    const t = totals.get(party._id as number);
    return {
      id: party._id,
      name: party.name,
      phone: party.phone ?? null,
      kg_in: t?.kg_in ?? 0,
      kg_out: t?.kg_out ?? 0,
      balance: balanceOf(t),
    };
  });
}

export async function partySummary(id: number) {
  return (await partySummaries()).find((party) => party.id === id)!;
}

const grouped = (value: number, digits = 0): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export async function statementFor(partyId: number) {
  const [stock, payments] = await Promise.all([
    (await col('stock_entries')).find({ party_id: partyId }).sort({ _id: 1 }).toArray(),
    (await col('payments')).find({ party_id: partyId }).sort({ _id: 1 }).toArray(),
  ]);

  const rows: { date: string; details: string; debit: number; credit: number }[] = [];

  for (const entry of stock) {
    const isSale = entry.type === 'out';
    rows.push({
      date: entry.date,
      details: `${isSale ? 'Sold ' : 'Bought '}${grouped(entry.kg)} kg @ ${grouped(entry.rate, 2)}`,
      debit: isSale ? entry.amount : 0,
      credit: isSale ? 0 : entry.amount,
    });

    if (entry.paid > 0) {
      rows.push({
        date: entry.date,
        details: isSale ? 'Cash received with sale' : 'Cash paid with purchase',
        debit: isSale ? 0 : entry.paid,
        credit: isSale ? entry.paid : 0,
      });
    }
  }

  for (const payment of payments) {
    const received = payment.direction === 'in';
    rows.push({
      date: payment.date,
      details: `${received ? 'Received' : 'Paid'} (${payment.mode})${payment.note ? ' - ' + payment.note : ''}`,
      debit: received ? 0 : payment.amount,
      credit: received ? payment.amount : 0,
    });
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let balance = 0;
  return rows.map((row) => {
    balance += row.debit - row.credit;
    return { ...row, balance: round2(balance) };
  });
}

export async function vehicleSummaries() {
  const [vehicles, stock, expenses] = await Promise.all([
    (await col('vehicles')).find().sort({ number: 1 }).toArray(),
    (await col('stock_entries'))
      .aggregate([
        { $match: { vehicle_id: { $ne: null } } },
        { $group: { _id: { v: '$vehicle_id', t: '$type' }, kg: { $sum: '$kg' }, trips: { $sum: 1 } } },
      ])
      .toArray(),
    (await col('expenses'))
      .aggregate([{ $match: { vehicle_id: { $ne: null } } }, { $group: { _id: '$vehicle_id', amount: { $sum: '$amount' } } }])
      .toArray(),
  ]);

  return vehicles.map((vehicle) => {
    const mine = stock.filter((row) => row._id.v === vehicle._id);
    return {
      id: vehicle._id,
      number: vehicle.number,
      driver: vehicle.driver ?? null,
      trips: mine.reduce((sum, row) => sum + row.trips, 0),
      kg_in: mine.find((row) => row._id.t === 'in')?.kg ?? 0,
      kg_out: mine.find((row) => row._id.t === 'out')?.kg ?? 0,
      expenses: expenses.find((row) => row._id === vehicle._id)?.amount ?? 0,
    };
  });
}
