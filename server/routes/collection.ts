import { Router, Response } from 'express';
import * as db from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/collection - Get user's comics
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT upc, name, issue_number as "issueNumber", series_name as "seriesName",
              series_volume as "seriesVolume", series_year as "seriesYear",
              cover_image as "coverImage", printing, variant_number as "variantNumber"
       FROM user_comics WHERE user_id = $1 ORDER BY added_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get collection' });
  }
});

// POST /api/collection - Add comic to collection
router.post('/', async (req: AuthRequest, res: Response) => {
  const comic = req.body;

  if (!comic.upc) {
    res.status(400).json({ error: 'UPC required' });
    return;
  }

  try {
    await db.query(
      `INSERT INTO user_comics (user_id, upc, name, issue_number, series_name, series_volume, series_year, cover_image, printing, variant_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, upc) DO NOTHING`,
      [req.user!.id, comic.upc, comic.name, comic.issueNumber, comic.seriesName,
       comic.seriesVolume, comic.seriesYear, comic.coverImage, comic.printing, comic.variantNumber]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comic' });
  }
});

// DELETE /api/collection/:upc - Remove comic from collection
router.delete('/:upc', async (req: AuthRequest, res: Response) => {
  try {
    await db.query(
      'DELETE FROM user_comics WHERE user_id = $1 AND upc = $2',
      [req.user!.id, req.params.upc]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove comic' });
  }
});

export default router;
