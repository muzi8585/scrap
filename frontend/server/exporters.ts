import ExcelJS from 'exceljs';
import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import { col, Doc, partySummaries, vehicleSummaries, withRefs } from './logic.js';

const iso = (value: unknown) => String(value ?? '');

export async function excelFor(module: string): Promise<ArrayBuffer | ExcelJS.Buffer | null> {
  let headings: string[];
  let rows: unknown[][];

  if (module === 'stock') {
    headings = ['Date', 'Type', 'Party', 'Vehicle', 'Kg', 'Rate per kg', 'Amount', 'Paid', 'Pending'];
    const data = await withRefs(await (await col('stock_entries')).find().sort({ date: 1, _id: 1 }).toArray());
    rows = data.map((e) => [
      iso(e.date),
      e.type === 'in' ? 'Incoming' : 'Outgoing',
      e.party.name,
      e.vehicle?.number ?? '',
      e.kg,
      e.rate,
      e.amount,
      e.paid,
      Math.round((e.amount - e.paid) * 100) / 100,
    ]);
  } else if (module === 'payments') {
    headings = ['Date', 'Party', 'Direction', 'Amount', 'Mode', 'Note'];
    const data = await withRefs(await (await col('payments')).find().sort({ date: 1, _id: 1 }).toArray(), true, false);
    rows = data.map((p) => [iso(p.date), p.party.name, p.direction === 'in' ? 'Received' : 'Paid', p.amount, p.mode, p.note ?? '']);
  } else if (module === 'expenses') {
    headings = ['Date', 'Category', 'Paid to', 'Vehicle', 'Details', 'Amount'];
    const data = await withRefs(await (await col('expenses')).find().sort({ date: 1, _id: 1 }).toArray(), false, true);
    rows = data.map((x) => [iso(x.date), x.category, x.paid_to ?? '', x.vehicle?.number ?? '', x.details ?? '', x.amount]);
  } else if (module === 'parties') {
    headings = ['Party', 'Kg in', 'Kg out', 'Balance', 'Status'];
    rows = (await partySummaries()).map((s) => [s.name, s.kg_in, s.kg_out, s.balance, s.balance >= 0 ? 'To receive' : 'To pay']);
  } else {
    return null;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(module);
  sheet.addRow(headings).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((column) => {
    column.width = 18;
  });
  return workbook.xlsx.writeBuffer();
}

const safe = (value: string): string => value.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');

const grouped = (value: number): string => Math.round(value).toLocaleString('en-US');

export async function statementPdf(
  partyName: string,
  rows: { date: string; details: string; debit: number; credit: number; balance: number }[],
  balance: number
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = 595;
  const height = 842;
  const left = 40;
  const right = width - 40;
  const columns = { date: left, details: left + 70, debit: right - 190, credit: right - 105, balance: right };

  let page = pdf.addPage([width, height]);
  let y = height - 50;

  const textRight = (value: string, x: number, size: number, f: PDFFont) =>
    page.drawText(value, { x: x - f.widthOfTextAtSize(value, size), y, size, font: f });

  const header = () => {
    page.drawText('Date', { x: columns.date, y, size: 10, font: bold });
    page.drawText('Details', { x: columns.details, y, size: 10, font: bold });
    textRight('Debit', columns.debit, 10, bold);
    textRight('Credit', columns.credit, 10, bold);
    textRight('Balance', columns.balance, 10, bold);
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.8, color: rgb(0, 0, 0) });
    y -= 14;
  };

  page.drawText(safe(process.env.APP_NAME || 'Scrap Business Manager'), { x: left, y, size: 16, font: bold });
  y -= 22;
  page.drawText(safe(`Statement: ${partyName}`), { x: left, y, size: 12, font: bold });
  y -= 28;
  header();

  for (const row of rows) {
    if (y < 70) {
      page = pdf.addPage([width, height]);
      y = height - 50;
      header();
    }

    let details = safe(row.details);
    const maxWidth = columns.debit - columns.details - 50;
    while (font.widthOfTextAtSize(details, 9) > maxWidth && details.length > 3) details = details.slice(0, -1);

    page.drawText(row.date, { x: columns.date, y, size: 9, font });
    page.drawText(details, { x: columns.details, y, size: 9, font });
    if (row.debit) textRight(grouped(row.debit), columns.debit, 9, font);
    if (row.credit) textRight(grouped(row.credit), columns.credit, 9, font);
    textRight(grouped(row.balance), columns.balance, 9, font);
    y -= 15;
  }

  if (y < 70) {
    page = pdf.addPage([width, height]);
    y = height - 50;
  }
  y -= 10;
  page.drawLine({ start: { x: left, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.8, color: rgb(0, 0, 0) });
  page.drawText(`${balance >= 0 ? 'To receive' : 'To pay'}: ${grouped(Math.abs(balance))}`, { x: left, y: y - 8, size: 11, font: bold });

  return pdf.save();
}


interface PdfColumn {
  title: string;
  weight: number;
  right?: boolean;
}

interface PdfTable {
  title: string;
  subtitle: string;
  columns: PdfColumn[];
  rows: string[][];
  totals?: string[];
  notes?: string[];
  landscape?: boolean;
}

export async function tablePdf(table: PdfTable): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const [width, height] = table.landscape ? [842, 595] : [595, 842];
  const margin = 36;
  const size = 8.5;
  const rowHeight = 16;
  const bottom = 50;
  const totalWeight = table.columns.reduce((sum, c) => sum + c.weight, 0);
  const widths = table.columns.map((c) => ((width - margin * 2) * c.weight) / totalWeight);
  const starts = widths.map((_, i) => margin + widths.slice(0, i).reduce((sum, w) => sum + w, 0));

  let page = pdf.addPage([width, height]);
  let y = height - 44;

  const fit = (value: string, max: number, f: PDFFont): string => {
    let text = safe(value);
    if (f.widthOfTextAtSize(text, size) <= max) return text;
    while (text.length > 1 && f.widthOfTextAtSize(text + '..', size) > max) text = text.slice(0, -1);
    return text + '..';
  };

  const drawRow = (cells: string[], f: PDFFont) => {
    cells.forEach((value, i) => {
      const text = fit(value, widths[i] - 8, f);
      const x = table.columns[i].right
        ? starts[i] + widths[i] - 4 - f.widthOfTextAtSize(text, size)
        : starts[i] + 4;
      page.drawText(text, { x, y, size, font: f });
    });
  };

  const rule = (thickness: number) =>
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness, color: rgb(0, 0, 0) });

  const header = () => {
    drawRow(table.columns.map((c) => c.title), bold);
    y -= 6;
    rule(0.8);
    y -= 14;
  };

  page.drawText(safe(process.env.APP_NAME || 'Scrap Business Manager'), { x: margin, y, size: 15, font: bold });
  y -= 20;
  page.drawText(safe(table.title), { x: margin, y, size: 12, font: bold });
  y -= 14;
  page.drawText(safe(table.subtitle), { x: margin, y, size: 9, font });
  y -= 26;
  header();

  const ensureSpace = (needed: number, repeatHeader: boolean) => {
    if (y - needed >= bottom) return;
    page = pdf.addPage([width, height]);
    y = height - 44;
    if (repeatHeader) header();
  };

  if (!table.rows.length) {
    page.drawText('No records.', { x: margin + 4, y, size: 10, font });
    y -= rowHeight;
  }

  for (const row of table.rows) {
    ensureSpace(rowHeight, true);
    drawRow(row, font);
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) });
    y -= rowHeight - 4;
  }

  if (table.totals) {
    ensureSpace(rowHeight + 10, true);
    y += rowHeight - 8;
    rule(0.8);
    y -= 14;
    drawRow(table.totals, bold);
    y -= rowHeight;
  }

  for (const note of table.notes ?? []) {
    ensureSpace(rowHeight, false);
    page.drawText(safe(note), { x: margin + 4, y, size: 10, font: bold });
    y -= rowHeight;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: width - margin - 60, y: 24, size: 8, font });
  });

  return pdf.save();
}

const n0 = (value: number): string => Math.round(value).toLocaleString('en-US');
const n2 = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const t3 = (kg: number): string => (kg / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
const sumOf = (rows: Doc[], pick: (row: Doc) => number): number => rows.reduce((total, row) => total + pick(row), 0);

const rangeMatch = (from: string, to: string): Doc => {
  const range: Doc = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return Object.keys(range).length ? { date: range } : {};
};

export async function moduleListPdf(
  module: string,
  query: { type: string; from: string; to: string }
): Promise<Uint8Array | null> {
  const period = query.from || query.to ? `From ${query.from || 'start'} to ${query.to || 'today'}` : 'All dates';
  const subtitle = `${period}  |  Generated ${new Date().toISOString().slice(0, 10)}`;
  const range = rangeMatch(query.from, query.to);

  if (module === 'stock') {
    const type = query.type === 'in' || query.type === 'out' ? query.type : '';
    const rows = await withRefs(
      await (await col('stock_entries')).find({ ...range, ...(type ? { type } : {}) }).sort({ date: 1, _id: 1 }).toArray()
    );
    const title = type === 'in' ? 'Incoming stock' : type === 'out' ? 'Outgoing stock' : 'Stock in and out';
    const kg = sumOf(rows, (r) => r.kg);
    const amount = sumOf(rows, (r) => r.amount);
    const paid = sumOf(rows, (r) => r.paid);
    const sold = rows.filter((r) => r.type === 'out');
    const bought = rows.filter((r) => r.type === 'in');

    return tablePdf({
      title,
      subtitle,
      landscape: true,
      columns: [
        { title: 'Date', weight: 1.1 },
        { title: 'Type', weight: 0.8 },
        { title: 'Party', weight: 2.3 },
        { title: 'Vehicle', weight: 1.2 },
        { title: 'Kg', weight: 1, right: true },
        { title: 'Tons', weight: 0.9, right: true },
        { title: 'Rate', weight: 0.9, right: true },
        { title: 'Amount', weight: 1.3, right: true },
        { title: 'Paid', weight: 1.2, right: true },
        { title: 'Pending', weight: 1.2, right: true },
      ],
      rows: rows.map((r) => [
        r.date,
        r.type === 'in' ? 'Incoming' : 'Outgoing',
        r.party.name,
        r.vehicle?.number ?? '',
        n0(r.kg),
        t3(r.kg),
        n2(r.rate),
        n0(r.amount),
        n0(r.paid),
        n0(r.amount - r.paid),
      ]),
      totals: type
        ? ['Total', '', '', '', n0(kg), t3(kg), '', n0(amount), n0(paid), n0(amount - paid)]
        : undefined,
      notes: type
        ? undefined
        : [
            `Incoming: ${n0(sumOf(bought, (r) => r.kg))} kg, Rs ${n0(sumOf(bought, (r) => r.amount))}`,
            `Outgoing: ${n0(sumOf(sold, (r) => r.kg))} kg, Rs ${n0(sumOf(sold, (r) => r.amount))}`,
          ],
    });
  }

  if (module === 'payments') {
    const rows = await withRefs(await (await col('payments')).find(range).sort({ date: 1, _id: 1 }).toArray(), true, false);
    const received = rows.filter((r) => r.direction === 'in');
    const paid = rows.filter((r) => r.direction === 'out');

    return tablePdf({
      title: 'Payments',
      subtitle,
      columns: [
        { title: 'Date', weight: 1.2 },
        { title: 'Party', weight: 2.4 },
        { title: 'Direction', weight: 1.1 },
        { title: 'Mode', weight: 1 },
        { title: 'Note', weight: 2.4 },
        { title: 'Amount', weight: 1.3, right: true },
      ],
      rows: rows.map((r) => [r.date, r.party.name, r.direction === 'in' ? 'Received' : 'Paid', r.mode, r.note ?? '', n0(r.amount)]),
      notes: [
        `Total received: Rs ${n0(sumOf(received, (r) => r.amount))}`,
        `Total paid: Rs ${n0(sumOf(paid, (r) => r.amount))}`,
      ],
    });
  }

  if (module === 'expenses') {
    const rows = await withRefs(await (await col('expenses')).find(range).sort({ date: 1, _id: 1 }).toArray(), false, true);

    return tablePdf({
      title: 'Expenses',
      subtitle,
      columns: [
        { title: 'Date', weight: 1.2 },
        { title: 'Category', weight: 1.6 },
        { title: 'Paid to', weight: 1.6 },
        { title: 'Vehicle', weight: 1.2 },
        { title: 'Details', weight: 2.2 },
        { title: 'Amount', weight: 1.3, right: true },
      ],
      rows: rows.map((r) => [r.date, r.category, r.paid_to ?? '', r.vehicle?.number ?? '', r.details ?? '', n0(r.amount)]),
      totals: ['Total', '', '', '', '', n0(sumOf(rows, (r) => r.amount))],
    });
  }

  if (module === 'parties') {
    const rows = await partySummaries();
    const phones = new Map((await (await col('parties')).find().toArray()).map((p) => [p._id as number, (p.phone ?? '') as string]));

    return tablePdf({
      title: 'Parties',
      subtitle: `Generated ${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { title: 'Party', weight: 2.4 },
        { title: 'Phone', weight: 1.4 },
        { title: 'Kg in', weight: 1, right: true },
        { title: 'Kg out', weight: 1, right: true },
        { title: 'Balance', weight: 1.3, right: true },
        { title: 'Status', weight: 1.1 },
      ],
      rows: rows.map((r) => [
        r.name,
        phones.get(r.id as number) ?? '',
        n0(r.kg_in),
        n0(r.kg_out),
        n0(Math.abs(r.balance)),
        r.balance >= 0 ? 'To receive' : 'To pay',
      ]),
      notes: [
        `Total to receive: Rs ${n0(sumOf(rows.filter((r) => r.balance > 0), (r) => r.balance))}`,
        `Total to pay: Rs ${n0(-sumOf(rows.filter((r) => r.balance < 0), (r) => r.balance))}`,
      ],
    });
  }

  if (module === 'vehicles') {
    const rows = await vehicleSummaries();

    return tablePdf({
      title: 'Vehicles',
      subtitle: `Generated ${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { title: 'Vehicle', weight: 1.6 },
        { title: 'Driver', weight: 1.8 },
        { title: 'Trips', weight: 0.8, right: true },
        { title: 'Tons received', weight: 1.3, right: true },
        { title: 'Tons sent', weight: 1.2, right: true },
        { title: 'Expenses', weight: 1.3, right: true },
      ],
      rows: rows.map((r) => [r.number, r.driver ?? '', String(r.trips), t3(r.kg_in), t3(r.kg_out), n0(r.expenses)]),
      totals: [
        'Total',
        '',
        String(sumOf(rows, (r) => r.trips)),
        t3(sumOf(rows, (r) => r.kg_in)),
        t3(sumOf(rows, (r) => r.kg_out)),
        n0(sumOf(rows, (r) => r.expenses)),
      ],
    });
  }

  if (module === 'rates') {
    const rows = await (await col('rates')).find(range).sort({ date: -1, _id: -1 }).toArray();

    return tablePdf({
      title: 'Rate history',
      subtitle,
      columns: [
        { title: 'Date', weight: 1.5 },
        { title: 'Buy rate per kg', weight: 1.5, right: true },
        { title: 'Sell rate per kg', weight: 1.5, right: true },
      ],
      rows: rows.map((r) => [r.date, n2(r.buy), n2(r.sell)]),
    });
  }

  return null;
}
