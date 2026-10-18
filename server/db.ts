import { Db, MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'scrap-erp';

const store = globalThis as unknown as { __scrapDb?: Promise<Db> };

async function prepare(db: Db): Promise<Db> {
  await Promise.all([
    db.collection('parties').createIndex({ name: 1 }, { unique: true }),
    db.collection('vehicles').createIndex({ number: 1 }, { unique: true }),
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('stock_entries').createIndex({ date: -1 }),
    db.collection('stock_entries').createIndex({ party_id: 1 }),
    db.collection('payments').createIndex({ party_id: 1 }),
    db.collection('expenses').createIndex({ date: -1 }),
  ]);

  const users = db.collection<{ _id: number; name: string; email: string; password: string }>('users');
  if ((await users.countDocuments()) === 0) {
    await users.insertOne({
      _id: 1,
      name: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'password', 10),
    });
    await db.collection<{ _id: string; seq: number }>('counters').updateOne({ _id: 'users' }, { $set: { seq: 1 } }, { upsert: true });
  }

  return db;
}

export function getDb(): Promise<Db> {
  if (!store.__scrapDb) {
    store.__scrapDb = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 })
      .connect()
      .then((client) => prepare(client.db(dbName)))
      .catch((error) => {
        store.__scrapDb = undefined;
        throw error;
      });
  }
  return store.__scrapDb;
}

export async function nextId(name: string): Promise<number> {
  const db = await getDb();
  const result = await db
    .collection<{ _id: string; seq: number }>('counters')
    .findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return result!.seq;
}
