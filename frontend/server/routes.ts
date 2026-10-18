import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb, nextId } from './db.js';
import { HttpError, parse, requireAuth, signToken, wrap } from './http.js';
import {
  asText,
  balanceOf,
  col,
  dateRange,
  Doc,
  partySummaries,
  partySummary,
  partyTotals,
  round2,
  statementFor,
  toApi,
  vehicleSummaries,
  withRefs,
} from './logic.js';
import { excelFor, moduleListPdf, statementPdf } from './exporters.js';

const CATEGORIES = [
  'Labour',
  'Loading/Unloading',
  'Transport/Freight',
  'Vehicle fuel',
  'Vehicle repair',
  'Rent',
  'Electricity',
  'Other',
] as const;

const blank = (value: unknown) => (value === '' || value === undefined ? null : value);

const dateField = z
  .string({ required_error: 'The date field is required.', invalid_type_error: 'The date field must be a valid date.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'The date field must be a valid date.');

const positive = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `The ${label} field is required.` })
    .gt(0, `The ${label} field must be greater than 0.`);

const text = (label: string, max: number) =>
  z.preprocess(blank, z.string().max(max, `The ${label} field must not be greater than ${max} characters.`).nullable());

const requiredText = (label: string, max: number) =>
  z
    .string({ required_error: `The ${label} field is required.` })
    .trim()
    .min(1, `The ${label} field is required.`)
    .max(max, `The ${label} field must not be greater than ${max} characters.`);

const optionalId = z.preprocess(blank, z.union([z.null(), z.coerce.number().int()]));
const requiredId = (label: string) => z.coerce.number({ invalid_type_error: `The ${label} field is required.` }).int();
const direction = z.enum(['in', 'out'], { errorMap: () => ({ message: 'The selected direction is invalid.' }) });
const paidField = z.preprocess((v) => (v === '' || v == null ? 0 : v), z.coerce.number().min(0, 'The paid field must be at least 0.'));

async function mustExist(collection: string, id: number | null, field: string) {
  if (id === null) return;
  const found = await (await col(collection)).findOne({ _id: id });
  if (!found) throw new HttpError(422, `The selected ${field} is invalid.`, { [field]: [`The selected ${field} is invalid.`] });
}

async function create(collection: string, data: Doc): Promise<Doc> {
  const doc = { _id: await nextId(collection), ...data, created_at: new Date() };
  await (await col(collection)).insertOne(doc);
  return doc;
}

async function removeById(collection: string, id: number) {
  const result = await (await col(collection)).deleteOne({ _id: id });
  if (!result.deletedCount) throw new HttpError(404, 'Record not found.');
}

const idParam = (value: string): number => {
  const id = Number(value);
  if (!Number.isInteger(id)) throw new HttpError(404, 'Record not found.');
  return id;
};

const router = Router();

router.post(
  '/login',
  wrap(async (req, res) => {
    const data = parse(
      z.object({
        email: z.string({ required_error: 'The email field is required.' }).email('The email field must be a valid email address.'),
        password: z.string({ required_error: 'The password field is required.' }).min(1, 'The password field is required.'),
      }),
      req.body
    );

    const user = await (await col('users')).findOne({ email: data.email });
    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      throw new HttpError(422, 'Wrong email or password.');
    }

    res.json({ token: signToken(user._id as number), user: { id: user._id, name: user.name, email: user.email } });
  })
);

router.get(
  '/health',
  wrap(async (_req, res) => {
    await getDb();
    res.json({ ok: true });
  })
);

router.use(requireAuth);

router.post('/logout', (_req, res) => {
  res.status(204).end();
});

router.get(
  '/dashboard',
  wrap(async (req, res) => {
    const range = dateRange(req);
    const sum = async (collection: string, field: string, match: Doc) => {
      const rows = await (await col(collection))
        .aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }])
        .toArray();
      return (rows[0]?.total ?? 0) as number;
    };

    const [kgIn, kgOut, purchases, sales, spent, labour, paidIn, paidOut, payIn, payOut, allIn, allOut, totals, parties] =
      await Promise.all([
        sum('stock_entries', 'kg', { ...range, type: 'in' }),
        sum('stock_entries', 'kg', { ...range, type: 'out' }),
        sum('stock_entries', 'amount', { ...range, type: 'in' }),
        sum('stock_entries', 'amount', { ...range, type: 'out' }),
        sum('expenses', 'amount', range),
        sum('expenses', 'amount', { ...range, category: 'Labour' }),
        sum('stock_entries', 'paid', { ...range, type: 'in' }),
        sum('stock_entries', 'paid', { ...range, type: 'out' }),
        sum('payments', 'amount', { ...range, direction: 'in' }),
        sum('payments', 'amount', { ...range, direction: 'out' }),
        sum('stock_entries', 'kg', { type: 'in' }),
        sum('stock_entries', 'kg', { type: 'out' }),
        partyTotals(),
        (await col('parties')).find().sort({ name: 1 }).toArray(),
      ]);

    const balances = parties.map((party) => ({
      id: party._id as number,
      name: party.name as string,
      balance: balanceOf(totals.get(party._id as number)),
    }));

    const pending = balances
      .filter((row) => Math.abs(row.balance) > 0.5)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 8);

    const cashIn = paidOut + payIn;
    const cashOut = paidIn + payOut + spent;

    res.json({
      kg_in: kgIn,
      kg_out: kgOut,
      stock_in_hand_kg: allIn - allOut,
      purchases,
      sales,
      expenses: spent,
      labour,
      cash_flow: round2(cashIn - cashOut),
      receivable: round2(balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0)),
      payable: round2(-balances.filter((b) => b.balance < 0).reduce((s, b) => s + b.balance, 0)),
      profit: round2(sales - purchases - spent),
      pending,
    });
  })
);

router.get(
  '/rates/current',
  wrap(async (_req, res) => {
    const latest = await (await col('rates')).find().sort({ date: -1, _id: -1 }).limit(1).toArray();
    res.json(latest[0] ? toApi(latest[0]) : { buy: 0, sell: 0 });
  })
);

router.get(
  '/rates',
  wrap(async (_req, res) => {
    const rows = await (await col('rates')).find().sort({ date: -1, _id: -1 }).toArray();
    res.json(rows.map(toApi));
  })
);

router.post(
  '/rates',
  wrap(async (req, res) => {
    const data = parse(
      z.object({
        date: dateField,
        buy: z.coerce.number({ invalid_type_error: 'The buy field is required.' }).min(0, 'The buy field must be at least 0.'),
        sell: z.coerce.number({ invalid_type_error: 'The sell field is required.' }).min(0, 'The sell field must be at least 0.'),
      }),
      req.body
    );
    res.json(toApi(await create('rates', { ...data, buy: round2(data.buy), sell: round2(data.sell) })));
  })
);

router.delete(
  '/rates/:id',
  wrap(async (req, res) => {
    await removeById('rates', idParam(req.params.id));
    res.status(204).end();
  })
);

const partySchema = z.object({
  name: requiredText('name', 100),
  phone: text('phone', 30),
});

async function ensureUniqueParty(name: string, ignoreId?: number) {
  const clash = await (await col('parties')).findOne({ name });
  if (clash && clash._id !== ignoreId) {
    throw new HttpError(422, 'The name has already been taken.', { name: ['The name has already been taken.'] });
  }
}

router.get(
  '/parties',
  wrap(async (_req, res) => {
    res.json(await partySummaries());
  })
);

router.post(
  '/parties',
  wrap(async (req, res) => {
    const data = parse(partySchema, req.body);
    await ensureUniqueParty(data.name);
    const doc = await create('parties', data);
    res.json(await partySummary(doc._id));
  })
);

router.put(
  '/parties/:id',
  wrap(async (req, res) => {
    const id = idParam(req.params.id);
    const data = parse(partySchema, req.body);
    if (!(await (await col('parties')).findOne({ _id: id }))) throw new HttpError(404, 'Record not found.');
    await ensureUniqueParty(data.name, id);
    await (await col('parties')).updateOne({ _id: id }, { $set: data });
    res.json(await partySummary(id));
  })
);

router.delete(
  '/parties/:id',
  wrap(async (req, res) => {
    const id = idParam(req.params.id);
    const [stock, payments] = await Promise.all([
      (await col('stock_entries')).findOne({ party_id: id }),
      (await col('payments')).findOne({ party_id: id }),
    ]);
    if (stock || payments) throw new HttpError(422, 'This party has records and cannot be deleted.');
    await removeById('parties', id);
    res.status(204).end();
  })
);

router.get(
  '/parties/:id/statement',
  wrap(async (req, res) => {
    const id = idParam(req.params.id);
    const party = await (await col('parties')).findOne({ _id: id });
    if (!party) throw new HttpError(404, 'Record not found.');
    const summary = await partySummary(id);
    res.json({
      party: { id, name: party.name, phone: party.phone ?? null },
      balance: summary.balance,
      rows: await statementFor(id),
    });
  })
);

router.get(
  '/parties/:id/statement-pdf',
  wrap(async (req, res) => {
    const id = idParam(req.params.id);
    const party = await (await col('parties')).findOne({ _id: id });
    if (!party) throw new HttpError(404, 'Record not found.');
    const summary = await partySummary(id);
    const buffer = await statementPdf(party.name, await statementFor(id), summary.balance);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${id}.pdf"`);
    res.send(Buffer.from(buffer));
  })
);

router.get(
  '/vehicles',
  wrap(async (_req, res) => {
    res.json(await vehicleSummaries());
  })
);

router.post(
  '/vehicles',
  wrap(async (req, res) => {
    const data = parse(z.object({ number: requiredText('number', 30), driver: text('driver', 100) }), req.body);
    if (await (await col('vehicles')).findOne({ number: data.number })) {
      throw new HttpError(422, 'The number has already been taken.', { number: ['The number has already been taken.'] });
    }
    const doc = await create('vehicles', data);
    res.json((await vehicleSummaries()).find((v) => v.id === doc._id));
  })
);

router.delete(
  '/vehicles/:id',
  wrap(async (req, res) => {
    const id = idParam(req.params.id);
    await removeById('vehicles', id);
    await Promise.all([
      (await col('stock_entries')).updateMany({ vehicle_id: id }, { $set: { vehicle_id: null } }),
      (await col('expenses')).updateMany({ vehicle_id: id }, { $set: { vehicle_id: null } }),
    ]);
    res.status(204).end();
  })
);

const stockSchema = z.object({
  date: dateField,
  type: direction,
  party_id: requiredId('party'),
  vehicle_id: optionalId,
  kg: positive('kg'),
  rate: positive('rate'),
  paid: paidField,
  note: text('note', 255),
});

async function stockData(body: unknown): Promise<Doc> {
  const data = parse(stockSchema, body);
  await mustExist('parties', data.party_id, 'party_id');
  await mustExist('vehicles', data.vehicle_id, 'vehicle_id');
  const kg = round2(data.kg);
  const rate = round2(data.rate);
  return { ...data, kg, rate, paid: round2(data.paid), amount: round2(kg * rate) };
}

router.get(
  '/stock',
  wrap(async (req, res) => {
    const match: Doc = { ...dateRange(req) };
    const type = asText(req.query.type);
    const partyId = Number(asText(req.query.party_id));
    if (type) match.type = type;
    if (partyId) match.party_id = partyId;
    const rows = await (await col('stock_entries')).find(match).sort({ date: -1, _id: -1 }).toArray();
    res.json(await withRefs(rows));
  })
);

router.post(
  '/stock',
  wrap(async (req, res) => {
    const doc = await create('stock_entries', await stockData(req.body));
    res.json((await withRefs([doc]))[0]);
  })
);

router.put(
  '/stock/:id',
  wrap(async (req, res) => {
    const id = idParam(req.params.id);
    const data = await stockData(req.body);
    const result = await (await col('stock_entries')).findOneAndUpdate({ _id: id }, { $set: data }, { returnDocument: 'after' });
    if (!result) throw new HttpError(404, 'Record not found.');
    res.json((await withRefs([result]))[0]);
  })
);

router.delete(
  '/stock/:id',
  wrap(async (req, res) => {
    await removeById('stock_entries', idParam(req.params.id));
    res.status(204).end();
  })
);

router.get(
  '/payments',
  wrap(async (req, res) => {
    const match: Doc = { ...dateRange(req) };
    const partyId = Number(asText(req.query.party_id));
    if (partyId) match.party_id = partyId;
    const rows = await (await col('payments')).find(match).sort({ date: -1, _id: -1 }).toArray();
    res.json(await withRefs(rows, true, false));
  })
);

router.post(
  '/payments',
  wrap(async (req, res) => {
    const data = parse(
      z.object({
        date: dateField,
        party_id: requiredId('party'),
        direction,
        amount: positive('amount'),
        mode: z.enum(['Cash', 'Bank', 'Cheque', 'Online'], { errorMap: () => ({ message: 'The selected mode is invalid.' }) }),
        note: text('note', 255),
      }),
      req.body
    );
    await mustExist('parties', data.party_id, 'party_id');
    const doc = await create('payments', { ...data, amount: round2(data.amount) });
    res.json((await withRefs([doc], true, false))[0]);
  })
);

router.delete(
  '/payments/:id',
  wrap(async (req, res) => {
    await removeById('payments', idParam(req.params.id));
    res.status(204).end();
  })
);

router.get(
  '/expenses',
  wrap(async (req, res) => {
    const match: Doc = { ...dateRange(req) };
    const category = asText(req.query.category);
    if (category) match.category = category;
    const rows = await (await col('expenses')).find(match).sort({ date: -1, _id: -1 }).toArray();
    res.json(await withRefs(rows, false, true));
  })
);

router.post(
  '/expenses',
  wrap(async (req, res) => {
    const data = parse(
      z.object({
        date: dateField,
        category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'The selected category is invalid.' }) }),
        paid_to: text('paid to', 100),
        vehicle_id: optionalId,
        details: text('details', 255),
        amount: positive('amount'),
      }),
      req.body
    );
    await mustExist('vehicles', data.vehicle_id, 'vehicle_id');
    const doc = await create('expenses', { ...data, amount: round2(data.amount) });
    res.json((await withRefs([doc], false, true))[0]);
  })
);

router.delete(
  '/expenses/:id',
  wrap(async (req, res) => {
    await removeById('expenses', idParam(req.params.id));
    res.status(204).end();
  })
);

router.get(
  '/export-pdf/:module',
  wrap(async (req, res) => {
    const module = req.params.module;
    const type = asText(req.query.type);
    const buffer = await moduleListPdf(module, { type, from: asText(req.query.from), to: asText(req.query.to) });
    if (!buffer) throw new HttpError(404, 'Unknown export.');
    const suffix = module === 'stock' && (type === 'in' || type === 'out') ? '-' + type : '';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${module}${suffix}.pdf"`);
    res.send(Buffer.from(buffer));
  })
);

router.get(
  '/export/:module',
  wrap(async (req, res) => {
    const module = req.params.module;
    const buffer = await excelFor(module);
    if (!buffer) throw new HttpError(404, 'Unknown export.');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${module}.xlsx"`);
    res.send(Buffer.from(buffer));
  })
);

export default router;
