import { useState, useEffect, useMemo } from 'react'
import { Routes, Route } from 'react-router-dom'
import { SearchBar } from './components/SearchBar'
import { ComicGrid } from './components/ComicGrid'
import { Header } from './components/Header'
import { searchComics } from './services/api'
import { FileUpload } from './components/FileUpload'
import { QRConnect } from './components/QRConnect'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ScanPage } from './pages/ScanPage'
import { useAuth } from './context/AuthContext'
import { useToast } from './context/ToastContext'
import { ToastContainer, ConfirmModal } from './components/Toast'
import { EmptyState } from './components/EmptyState'
import type { Comic } from './types/comic'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL;

type SortOption = 'custom' | 'a-z' | 'z-a';

function HomePage() {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  // Initialize comics from localStorage (works as cache for both logged-in and anonymous)
  const [comics, setComics] = useState<Comic[]>(() => {
    const saved = localStorage.getItem('comics');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    const saved = localStorage.getItem('sortOption');
    return (saved as SortOption) || 'custom';
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load comics from API if logged in, clear if logged out
  useEffect(() => {
    if (user && token) {
      loadCollection();
    } else if (!user) {
      // User logged out - check if localStorage was cleared
      const saved = localStorage.getItem('comics');
      if (!saved) {
        setComics([]);
      }
    }
  }, [user, token]);

  // Save comics to localStorage (cache for both logged-in and anonymous)
  useEffect(() => {
    localStorage.setItem('comics', JSON.stringify(comics));
  }, [comics]);

  // Save sort option to localStorage
  useEffect(() => {
    localStorage.setItem('sortOption', sortOption);
  }, [sortOption]);

  // Sort comics based on current option
  const sortedComics = useMemo(() => {
    // Always put starred comics first
    const starred = comics.filter(c => c.starred);
    const unstarred = comics.filter(c => !c.starred);

    const sortFn = (a: Comic, b: Comic) => {
      if (sortOption === 'a-z') {
        const seriesCompare = a.seriesName.localeCompare(b.seriesName);
        if (seriesCompare !== 0) return seriesCompare;
        // Same series name - sort by year ascending
        const yearCompare = String(a.seriesYear || '').localeCompare(String(b.seriesYear || ''));
        if (yearCompare !== 0) return yearCompare;
        // Same series and year - sort by issue number ascending
        return parseFloat(a.issueNumber) - parseFloat(b.issueNumber);
      } else if (sortOption === 'z-a') {
        const seriesCompare = b.seriesName.localeCompare(a.seriesName);
        if (seriesCompare !== 0) return seriesCompare;
        // Same series name - sort by year descending
        const yearCompare = String(b.seriesYear || '').localeCompare(String(a.seriesYear || ''));
        if (yearCompare !== 0) return yearCompare;
        // Same series and year - sort by issue number ascending
        return parseFloat(a.issueNumber) - parseFloat(b.issueNumber);
      }
      // Custom order - use sortOrder
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    };

    return [...starred.sort(sortFn), ...unstarred.sort(sortFn)];
  }, [comics, sortOption]);

  async function loadCollection() {
    try {
      const response = await fetch(`${API_URL}/api/collection`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setComics(data);
      }
    } catch (err) {
      console.error('Failed to load collection:', err);
    }
  }

  async function saveToCollection(comic: Comic) {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(comic)
      });
    } catch (err) {
      console.error('Failed to save comic:', err);
    }
  }

  async function removeFromCollection(upc: string) {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/collection/${upc}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to remove comic:', err);
    }
  }

  async function updateStarred(upc: string, starred: boolean) {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/collection/${upc}/star`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ starred })
      });
    } catch (err) {
      console.error('Failed to update starred status:', err);
    }
  }

  async function updateSortOrder(comicsToUpdate: { upc: string; sortOrder: number }[]) {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/collection/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ comics: comicsToUpdate })
      });
    } catch (err) {
      console.error('Failed to update sort order:', err);
    }
  }

  async function handleSearch(upc: string) {
    setLoading(true);
    setError(null);

    try {
      const result = await searchComics(upc);

      if (result) {
        const isDuplicate = comics.some(c => c.upc === result.upc);

        if (isDuplicate) {
          showToast('Comic already in your collection', 'info');
        } else {
          const newComic = { ...result, sortOrder: comics.length };
          setComics(prev => [...prev, newComic]);
          if (user) saveToCollection(newComic);
          showToast(`Added "${result.seriesName} #${result.issueNumber}"`, 'success');
        }
      } else {
        setError('Comic not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleClearAll() {
    const count = comics.length;
    setComics([]);
    localStorage.removeItem('comics');
    setShowClearConfirm(false);

    if (user && token) {
      try {
        await fetch(`${API_URL}/api/collection`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to clear collection from database:', err);
      }
    }

    showToast(`Cleared ${count} comic${count !== 1 ? 's' : ''} from collection`, 'success');
  }

  async function handleExport() {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/collection/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comic-collection.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export:', err);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

      if (lines.length < 2) {
        setError('CSV file is empty or invalid');
        return;
      }

      // Parse CSV - skip header row (first non-comment line)
      const importedComics: Comic[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= 6 && values[0]) {
          importedComics.push({
            upc: values[0],
            name: values[1] || '',
            seriesName: values[2] || '',
            seriesVolume: values[3] || '',
            seriesYear: values[4] || '',
            issueNumber: values[5] || '',
            printing: values[6] || '',
            variantNumber: values[7] || '',
            starred: values[8]?.toLowerCase() === 'yes',
            coverImage: values[9] || ''
          });
        }
      }

      if (importedComics.length === 0) {
        setError('No valid comics found in CSV');
        return;
      }

      const response = await fetch(`${API_URL}/api/collection/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ comics: importedComics })
      });

      const result = await response.json();
      if (response.ok) {
        setError(null);
        loadCollection();
        alert(`Imported ${result.imported} comics (${result.skipped} duplicates skipped)`);
      } else {
        setError(result.error || 'Import failed');
      }
    } catch (err) {
      console.error('Failed to import:', err);
      setError('Failed to parse import file');
    }

    e.target.value = '';
  }

  // Helper to parse CSV line handling quoted fields
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  function handleRemoveComic(upc: string) {
    const comic = comics.find(c => c.upc === upc);
    setComics(prev => prev.filter(c => c.upc !== upc));
    if (user) removeFromCollection(upc);
    if (comic) {
      showToast(`Removed "${comic.seriesName} #${comic.issueNumber}"`, 'success');
    }
  }

  function handleToggleStar(upc: string) {
    setComics(prev => prev.map(comic => {
      if (comic.upc === upc) {
        const newStarred = !comic.starred;
        if (user) updateStarred(upc, newStarred);
        return { ...comic, starred: newStarred };
      }
      return comic;
    }));
  }

  function handleReorder(reorderedComics: Comic[]) {
    setComics(reorderedComics);
    setSortOption('custom'); // Switch to custom when manually reordering

    if (user) {
      const updates = reorderedComics.map((comic, index) => ({
        upc: comic.upc,
        sortOrder: index
      }));
      updateSortOrder(updates);
    }
  }

  function handleFileUpload(comic: Comic): boolean {
    const isDuplicate = comics.some(c => c.upc === comic.upc);
    if (isDuplicate) {
      showToast('Comic already in your collection', 'info');
      return false;
    }
    const newComic = { ...comic, sortOrder: comics.length };
    setComics(prev => [...prev, newComic]);
    setError(null);
    if (user) saveToCollection(newComic);
    showToast(`Added "${comic.seriesName} #${comic.issueNumber}"`, 'success');
    return true;
  }

  // Returns true if added, false if duplicate (for QR scanning)
  function handleQRScan(comic: Comic): boolean {
    const isDuplicate = comics.some(c => c.upc === comic.upc);

    if (isDuplicate) {
      showToast('Comic already in your collection', 'info');
      return false;
    } else {
      const newComic = { ...comic, sortOrder: comics.length };
      setComics(prev => [...prev, newComic]);
      setError(null);
      if (user) saveToCollection(newComic);
      showToast(`Added "${comic.seriesName} #${comic.issueNumber}"`, 'success');
      return true;
    }
  }

  return (
    <>
      <div className="controls">
        <SearchBar onSearch={handleSearch} />

        <div className="scan-actions">
          <FileUpload onComicFound={handleFileUpload} />
          <span className="scan-divider">or</span>
          <QRConnect onComicReceived={handleQRScan} />
        </div>

        {comics.length > 0 && (
          <div className="controls-row">
            <div className="controls-left">
              <div className="sort-controls">
                <label htmlFor="sort-select">Sort:</label>
                <select
                  id="sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="sort-select"
                >
                  <option value="custom">Custom Order</option>
                  <option value="a-z">Series A-Z</option>
                  <option value="z-a">Series Z-A</option>
                </select>
              </div>
            </div>
            <div className="action-buttons">
              {user && (
                <>
                  <button onClick={handleExport} className="export-button" disabled={comics.length === 0}>
                    Export
                  </button>
                  <label className="import-button">
                    Import
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleImport}
                      style={{ display: 'none' }}
                    />
                  </label>
                </>
              )}
              <button onClick={() => setShowClearConfirm(true)} className="clear-button">
                Clear All ({comics.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="loading">Searching...</div>}
      {error && <div className="error">{error}</div>}

      {comics.length === 0 ? (
        <EmptyState />
      ) : (
        <ComicGrid
          comics={sortedComics}
          onRemoveComic={handleRemoveComic}
          onToggleStar={handleToggleStar}
          onReorder={handleReorder}
        />
      )}

      {showClearConfirm && (
        <ConfirmModal
          message="Are you sure you want to clear your entire collection? This cannot be undone."
          onConfirm={handleClearAll}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </>
  );
}

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div className="app loading">Loading...</div>;
  }

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/scan/:sessionId" element={<ScanPage />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  );
}

export default App
