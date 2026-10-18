import 'dotenv/config';
import app from './app.js';
import { getDb } from './db.js';

const port = Number(process.env.PORT) || 8000;

getDb()
  .then(() => {
    app.listen(port, '127.0.0.1', () => console.log(`API ready on http://127.0.0.1:${port}`));
  })
  .catch((error) => {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  });
