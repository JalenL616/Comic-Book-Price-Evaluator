// Expects sanitized UPC

export function validateUPC (upc: string | undefined): {
  valid: boolean;
  error?: string;
} {

  // Check if input is provided
  if (!upc || upc == "") {
    return {valid: false, error: `UPC is required` };
  }

  // Check if only digits
  if (!/^\d+$/.test(upc)) {
    return { valid: false, error: 'UPC must contain only digits' };
  }

  // Check for valid length
  if (upc?.length != 17) {
    return {valid: false, error: `UPC must be 17 digits` };
  }

  return { valid: true};
}