import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from './app.js'

// Mock global fetch
global.fetch = vi.fn();

const SPIDER_MAN_METRON_RESPONSE = {
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 44879,
      "series": {
          "name": "The Amazing Spider-Man",
          "volume": 6,
          "year_began": 2022
      },
      "number": "1",
      "issue": "The Amazing Spider-Man (2022) #1",
      "cover_date": "2022-06-01",
      "store_date": "2022-04-27",
      "image": "https://static.metron.cloud/media/issue/2022/03/11/asm-1.png",
      "cover_hash": "dc2306f9bd49c439",
      "modified": "2025-08-04T15:45:13.310035-04:00"
    }
  ]
}

const ABSOLUTE_BATMAN_METRON_RESPONSE = {
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 127884,
      "series": {
          "name": "Absolute Batman",
          "volume": 1,
          "year_began": 2024
      },
      "number": "1",
      "issue": "Absolute Batman (2024) #1",
      "cover_date": "2024-12-01",
      "store_date": "2024-10-09",
      "image": "https://static.metron.cloud/media/issue/2024/09/23/2db9a60d7a4a41b180cd9017f3430b27.jpg",
      "cover_hash": "e284c8ade52d272f",
      "modified": "2025-03-24T09:26:34.369475-04:00"
    }
  ]
}

const EMPTY_METRON_RESPONSE = {
  "count": 0,
  "next": null,
  "previous": null,
  "results": []
};


beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/comics - UPC Validation', () => {
  it('returns 400 for missing UPC', async () => {
    const response = await request(app).get('/api/comics');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('UPC is required');
  });

  it('returns 400 for UPC with letters', async () => {
    const response = await request(app).get('/api/comics?search=ABC1234567890123');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('UPC must contain only digits');
  });

  it('returns 400 for UPC wrong size', async () => {
    const response = await request(app).get('/api/comics?search=12345');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('UPC must be 17 digits');
  });

  it('accepts UPC with spaces', async () => {
    const response = await request(app).get('/api/comics?search=12345 67890 123456 7');

    // Should succeed (after you fix the validation)
    expect(response.status).not.toBe(400);
  });

  it('returns 500 when comic search failed', async () => {
    const response = await request(app).get('/api/comics?search=99999999999999999');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to search comics');
  });
});

describe('GET /api/comics - Success Cases', () => {
  it('returns Spider-Man for correct UPC', async () => {
    const testUPC = '75960620200300111';

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => SPIDER_MAN_METRON_RESPONSE
    });

    const response = await request(app).get(`/api/comics?search=${testUPC}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      upc: testUPC,
      seriesName: 'The Amazing Spider-Man',
      issueNumber: '1',
      seriesVolume: 6,
      seriesYear: 2022,
      coverImage: 'https://static.metron.cloud/media/issue/2022/03/11/asm-1.png'
    });
  });
  
  it('returns Absolute Batman for different UPC', async () => {
    const testUPC = '76194134241105011';

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ABSOLUTE_BATMAN_METRON_RESPONSE
    });

    const response = await request(app)
      .get(`/api/comics?search=${testUPC}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      upc: testUPC,
      seriesName: 'Absolute Batman',
      issueNumber: '1',
      seriesVolume: 1,
      seriesYear: 2024
    });
  });

  it('sends correct UPC to Metron API', async () => {
    const testUPC = '75960620200300111';

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => SPIDER_MAN_METRON_RESPONSE
    });

    await request(app).get(`/api/comics?search=${testUPC}`);

    // Verify fetch was called correctly
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://metron.cloud/api/issue/?upc=${testUPC}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Basic'),
          'Accept': 'application/json'
        })
      })
    );
  });
  
  it('returns complete Comic interface', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => SPIDER_MAN_METRON_RESPONSE
    });

    const response = await request(app)
      .get('/api/comics?search=75960620200300111');

    const comic = response.body;

    // Verify all required Comic fields exist
    expect(comic).toHaveProperty('upc');
    expect(comic).toHaveProperty('name');
    expect(comic).toHaveProperty('issueNumber');
    expect(comic).toHaveProperty('seriesName');
    expect(comic).toHaveProperty('seriesVolume');
    expect(comic).toHaveProperty('seriesYear');
    expect(comic).toHaveProperty('coverImage');
    expect(comic).toHaveProperty('printing');
    expect(comic).toHaveProperty('variantNumber');

    // Verify types
    expect(typeof comic.upc).toBe('string');
    expect(typeof comic.seriesName).toBe('string');
    expect(typeof comic.issueNumber).toBe('string');
  });

  it('correctly extracts variant and printing from UPC', async () => {
    const variantUPC = '75960620200300121'; 
    // 16th digit = 2 (variant), 17th = 1 (first printing)

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => SPIDER_MAN_METRON_RESPONSE
    });

    const response = await request(app).get(`/api/comics?search=${variantUPC}`);

    expect(response.status).toBe(200);
    expect(response.body.variantNumber).toBe('2');  // 16th digit
    expect(response.body.printing).toBe('1');       // 17th digit
  });
});

describe('GET /api/comics - Error Handling', () => {
  it('returns 404 when comic not found', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => EMPTY_METRON_RESPONSE
    });

      const response = await request(app).get('/api/comics?search=99999999999999999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Comic not found');
  });

  it('returns 500 when Metron API fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const response = await request(app)
      .get('/api/comics?search=12345678901234567');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to search comics');
  });

  it('returns 500 when Metron API is unreachable', async () => {
    (global.fetch as any).mockRejectedValueOnce(
      new Error('Network error')
    );

    const response = await request(app)
      .get('/api/comics?search=12345678901234567');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to search comics');
  });
});

describe('GET /', () => {
  it('returns Hello World', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World!');
  });
});