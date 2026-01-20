import { useToast, type Toast as ToastType } from '../context/ToastContext';
import './Toast.css';

function ToastItem({ toast }: { toast: ToastType }) {
  const { removeToast } = useToast();

  return (
    <div className={`toast toast-${toast.type}`} onClick={() => removeToast(toast.id)}>
      <span className="toast-message">{toast.message}</span>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-buttons">
          <button className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-btn confirm-btn-confirm" onClick={onConfirm}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
