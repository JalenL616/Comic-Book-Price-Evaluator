import { useState } from 'react';

  const API_URL = import.meta.env.VITE_API_URL;

  export function FileUpload() {
    const [preview, setPreview] = useState<string | null>(null);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setPreview(imageUrl);
    }

    return (
      <div>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {preview && <img src={preview} alt="Processed" />}
      </div>
    );
  }
