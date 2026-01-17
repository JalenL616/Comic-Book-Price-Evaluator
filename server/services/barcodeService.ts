const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export interface BarcodeResult {
  upc: string;
  extension: string | null;
}

export async function scanBarcode(imageBuffer: Buffer): Promise<BarcodeResult | null> {
  try {
    const formData = new FormData();

    // Convert Buffer to Uint8Array, then to Blob
    const uint8Array = new Uint8Array(imageBuffer);
    const blob = new Blob([uint8Array], { type: 'image/jpeg' });
    formData.append('image', blob, 'image.jpg');

    console.log('Sending image to Python service...');

    const response = await fetch(`${PYTHON_SERVICE_URL}/scan`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Python service error:', error);
      return null;
    }

    const data = await response.json();
    console.log('UPC Scanned:', data.upc, 'Extension:', data.extension);

    return {
      upc: data.upc,
      extension: data.extension || null
    };

  } catch (error) {
    console.error('Error calling barcode service:', error);
    return null;
  }
}
