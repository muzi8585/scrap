import express from 'express';
import router from './routes.js';
import { errorHandler } from './http.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use('/api', router);
app.use(errorHandler);

export default app;
