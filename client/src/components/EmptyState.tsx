import './EmptyState.css';

interface EmptyStateProps {
  onSearchClick: () => void;
  onUploadClick: () => void;
  onScanClick: () => void;
}

export function EmptyState({ onSearchClick, onUploadClick, onScanClick }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-header">
        <h2>Welcome to Your Collection</h2>
        <p>Start building your comic book collection by adding your first comic.</p>
      </div>

      <div className="onboarding-cards">
        <button className="onboarding-card" onClick={onSearchClick} type="button">
          <div className="onboarding-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <h3>Search by UPC</h3>
          <p>Enter the barcode number from your comic to look up its details and value.</p>
        </button>

        <button className="onboarding-card" onClick={onUploadClick} type="button">
          <div className="onboarding-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3>Upload Cover</h3>
          <p>Upload a photo of your comic cover and we'll identify it automatically.</p>
        </button>

        <button className="onboarding-card" onClick={onScanClick} type="button">
          <div className="onboarding-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12" y2="18.01" />
            </svg>
          </div>
          <h3>Scan with Phone</h3>
          <p>Connect your phone to scan barcodes directly using your camera.</p>
        </button>
      </div>
    </div>
  );
}
