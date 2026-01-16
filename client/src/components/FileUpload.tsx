import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

interface Comic {
  upc: string;
  seriesName: string;
  issueNumber: string;
  coverImage: string;
}

export function FileUpload() {
  const [comic, setComic] = useState<Comic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setComic(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      console.log('📤 Uploading file:', file.name);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      console.log('✅ Comic found:', data);
      setComic(data);

    } catch (err) {
      console.error('❌ Error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {loading && <p>Scanning barcode...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {comic && (
        <div>
          <h3>{comic.seriesName} #{comic.issueNumber}</h3>
          <img src={comic.coverImage} alt={comic.seriesName} style={{ maxWidth: '200px' }} />
        </div>
      )}
    </div>
  );
}