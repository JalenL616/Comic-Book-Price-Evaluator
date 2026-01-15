import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchComicByUPC } from './metronService.js'

// Mock the global fetch
global.fetch = vi.fn();

describe('searchComicByUPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.METRON_USERNAME = 'test-user';
    process.env.METRON_PASSWORD = 'test-password';
  });

  it('returns comic when found', async () => {
    const mockResponse = {
    count: 1,
    results: [{
      series: { name: 'Spider-Man', volume: '1', year_began: '1963' },
      number: '1',
      issue: 'Amazing Spider-Man #1',
      image: 'http://example.com/image.jpg'
    }]
    };

    (fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => mockResponse
    });

    const result = await searchComicByUPC('12345678901234567');

    expect(result).not.toBeNull();
    expect(result?.seriesName).toBe('Spider-Man');
  });

  it('returns null when no results', async () => {
    (fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ count: 0, results: [] })
    });

    const result = await searchComicByUPC('99999999999999999');

    expect(result).toBeNull();
  });

  it('throws error when API returns error status', async () => {
    (fetch as any).mockResolvedValueOnce({
    ok: false,
    status: 500
    });

    await expect(searchComicByUPC('12345678901234567'))
    .rejects
    .toThrow('Metron API error: 500');
  });

  it('throws error when credentials missing', async () => {
    // Temporarily remove env vars
    const originalUsername = process.env.METRON_USERNAME;
    const originalPassword = process.env.METRON_PASSWORD;

    delete process.env.METRON_USERNAME;
    delete process.env.METRON_PASSWORD;

    await expect(searchComicByUPC('12345678901234567'))
    .rejects
    .toThrow('Metron API credentials not configured');

    // Restore
    process.env.METRON_USERNAME = originalUsername;
    process.env.METRON_PASSWORD = originalPassword;
  });

  it('sends correct Authorization header', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, results: [] })
    });

    await searchComicByUPC('12345678901234567');

    const fetchCall = (fetch as any).mock.calls[0];
    const headers = fetchCall[1].headers;

    expect(headers.Authorization).toContain('Basic ');
  });
});