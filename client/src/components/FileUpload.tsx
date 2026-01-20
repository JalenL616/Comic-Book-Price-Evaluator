import { useState, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import type { Comic } from '../types/comic';

const API_URL = import.meta.env.VITE_API_URL;

interface FileUploadProps {
  onComicFound: (comic: Comic) => boolean; // Returns true if added, false if duplicate
}

export function FileUpload({ onComicFound }: FileUploadProps) {
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const { showToast } = useToast();

  async function uploadFile(file: File): Promise<Comic | null> {
    if (cancelledRef.current) return null;

    try {
      const formData = new FormData();
      formData.append('image', file);

      console.log('Uploading file:', file.name);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (cancelledRef.current) return null;

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      console.log('Comic found:', data);
      return data;

    } catch (err) {
      if (cancelledRef.current) return null;
      console.error('Error uploading', file.name, ':', err);
      throw err;
    }
  }

  async function uploadFiles(files: File[]) {
    setLoading(true);
    setProgress({ current: 0, total: files.length });
    cancelledRef.current = false;

    let failedCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (cancelledRef.current) break;

      setProgress({ current: i + 1, total: files.length });

      try {
        const comic = await uploadFile(files[i]);
        if (comic) {
          onComicFound(comic);
        }
      } catch (err) {
        if (cancelledRef.current) break;
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        showToast(`Scan failed: ${errorMsg}`, 'error');
      }
    }

    setLoading(false);
    setProgress(null);

    if (cancelledRef.current) {
      showToast('Upload cancelled', 'info');
    }
  }

  function handleCancel() {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      uploadFiles(imageFiles);
    }
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      uploadFiles(files);
    } else {
      showToast('Please drop image files', 'error');
    }
  }

  function getButtonText() {
    if (loading && progress) {
      return `Scanning ${progress.current}/${progress.total}...`;
    }
    if (loading) {
      return 'Scanning...';
    }
    if (isDragging) {
      return 'Drop images here';
    }
    return 'Upload Comic Image';
  }

  return (
    <div className="file-upload">
      <label
        className={`upload-button ${isDragging ? 'dragging' : ''} ${loading ? 'loading' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {getButtonText()}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          disabled={loading}
          style={{ display: 'none' }}
        />
      </label>
      {loading && (
        <button type="button" onClick={handleCancel} className="cancel-button">
          Cancel
        </button>
      )}
    </div>
  );
}
