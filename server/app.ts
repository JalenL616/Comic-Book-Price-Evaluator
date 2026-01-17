import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import 'dotenv/config';
import { validateUPC } from './utils/validation.js';
import { sanitizeUPC } from './utils/sanitization.js';
import { scanBarcode } from './services/barcodeService.js';
import { searchComicByUPC } from './services/metronService.js';

import * as db from './db.js';

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://comic-price-evaluator.vercel.app',
    'https://comic-scans.vercel.app'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Manual UPC search (SearchBar uses this)
app.get('/api/comics', async (req, res) => {
  const upc = req.query.search as string;
  const cleanedUPC = sanitizeUPC(upc);
  
  const validation = validateUPC(cleanedUPC);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  try {
    const comic = await searchComicByUPC(cleanedUPC);

    if (!comic) {
      res.status(404).json({ error: 'Comic not found' });
      return;
    }

    console.log(`Found comic with UPC: ${cleanedUPC}`);
    res.json(comic);
  } catch (error) {
    console.log('Error searching comic:', error);
    res.status(500).json({ error: 'Failed to search comics' });
  }
});

// Image upload with barcode scanning (FileUpload uses this)
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    // Step 1: Scan barcode using Python service
    const result = await scanBarcode(req.file.buffer);

    if (!result) {
      res.status(400).json({ error: 'Could not detect barcode' });
      return;
    }

    if (!result.extension) {
      res.status(400).json({ error: 'Could not detect 5-digit extension', upc: result.upc });
      return;
    }

    console.log(`Scanned UPC: ${result.upc}, Extension: ${result.extension}`);

    // Step 2: Build UPC for search
    // If last 2 digits aren't '11', search with '11' (Metron only has standard covers)
    const extension = result.extension;
    const lastTwoDigits = extension.slice(-2);
    const searchExtension = lastTwoDigits === '11' ? extension : extension.slice(0, 3) + '11';

    const fullUpc = result.upc + extension;
    const searchUpc = result.upc + searchExtension;

    console.log(`Full UPC: ${fullUpc}, Search UPC: ${searchUpc}`);

    // Step 3: Look up comic using Metron API (with '11' suffix for variants)
    const comic = await searchComicByUPC(searchUpc);

    if (!comic) {
      res.status(404).json({ error: 'Comic not found', upc: result.upc, extension: result.extension });
      return;
    }

    // Step 4: Return comic data (use actual scanned UPC, not search UPC)
    comic.upc = fullUpc;
    res.json(comic);

  } catch (error) {
    console.error('Upload processing error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});


app.get('/init', async (req: Request, res: Response) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS test_users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL
            );
        `);
        res.send("Table created!");
    } catch (err: any) {
        res.status(500).send(err.message);
    }
});

app.post('/add-user', async (req: Request, res: Response) => {
    const { name, email } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING *',
            [name, email]
        );
        res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/users', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM test_users');
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).send(err.message);
    }
});

export default app;