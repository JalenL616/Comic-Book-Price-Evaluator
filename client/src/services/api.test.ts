import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchComics } from './api'

globalThis.fetch = vi.fn();

describe('searchComics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns comics on success', async () => {
    const mockComics = [{ id: 1, title: 'Spider-Man' }];

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockComics
    });

    const result = await searchComics('12345678901234567');

    expect(result).toEqual(mockComics);
  });

  it('throws error with message from API', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'UPC must be 17 digits' })
    });

    await expect(searchComics('123'))
      .rejects
      .toThrow('UPC must be 17 digits');
  });

  it('throws generic error if no error message', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({})
    });

    await expect(searchComics('12345678901234567'))
      .rejects
      .toThrow('Search failed');
  });
});
