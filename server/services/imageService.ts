export async function processImage(buffer: Buffer): Promise<Buffer> {
// Example: Just return the same image for now
// Later you could add: barcode scanning, resizing, etc.

console.log(`Processing image of size: ${buffer.length} bytes`);

// Do your processing here...
// const result = await scanBarcode(buffer);
// const resized = await resizeImage(buffer);

return buffer;  // Return processed buffer
}
