import express from 'express'
import cors from 'cors'
import multer from 'multer';
import 'dotenv/config'
import { validateUPC } from './utils/validation.js'
import { searchComicByUPC } from './services/metronService.js'
import { sanitizeUPC } from './utils/sanitization.js'
import { processImage } from './services/imageService.js'

const app = express()

app.use(cors({
  origin: [
    'http://localhost:5173',  // Local development
    'https://comic-price-evaluator.vercel.app'  // Production
  ]
}))

app.use(express.json())

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }  // 5MB limit
  });

// Test route
app.get('/', (req, res) => {
  res.send('Hello World!')
})

// Comic search route
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
      return res.status(404).json({ error: 'Comic not found' });
    }

    console.log(`Found comic with UPC: ${cleanedUPC}`)
    res.json(comic);
  } catch (error) {
      console.log('Error searching comic:', error);
      res.status(500).json({
      error: 'Failed to search comics'
    })
  }
})

app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const processedBuffer = await processImage(req.file.buffer);

    res.set('Content-Type', req.file.mimetype);
    res.send(processedBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Processing failed' });
  }
});

export default app