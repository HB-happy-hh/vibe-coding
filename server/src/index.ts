import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { mountScan } from './scan.ts';

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
mountScan(app);
app.get('/health', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`[scan] listening on :${port}`));
