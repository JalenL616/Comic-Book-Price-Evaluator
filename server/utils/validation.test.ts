import { describe, it, expect } from 'vitest'
import { validateUPC } from './validation.js'

describe('validateUPC', () => {
  describe('Valid UPCs', () => {
    it('accepts 17-digit UPC', () => {
      const result = validateUPC('12345678901234567');
      expect(result.valid).toBe(true);
    });

    it('accepts UPC with leading zeros', () => {
      const result = validateUPC('00000000000000001');
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid UPCs', () => {
    it('rejects empty string', () => {
      const result = validateUPC('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('UPC is required');
    });

    it('rejects undefined', () => {
      const result = validateUPC(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('UPC is required');
    });

    it('rejects UPC with letters', () => {
      const result = validateUPC('1234567890123456A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('UPC must contain only digits');
    });

    it('rejects UPC with special characters', () => {
      const result = validateUPC('1234567890123456-');
      expect(result.valid).toBe(false);
    });

    it('rejects UPC shorter than 17 digits', () => {
      const result = validateUPC('1234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('UPC must be 17 digits');
    });

    it('rejects UPC longer than 17 digits', () => {
      const result = validateUPC('123456789012345678');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('UPC must be 17 digits');
    });
  });
});

