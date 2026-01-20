import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="site-header">
      <Link to="/" className="site-title">
        <img src="/logoBackgroundless.png" alt="Comic Scans" className="site-logo" />
        <h1>Comic Scans</h1>
      </Link>

      <nav className="header-nav">
        {user ? (
          <div className="user-menu">
            <span className="welcome-text">Welcome, {user.name || user.email}</span>
            <button onClick={logout} className="logout-button">
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="header-link">Login</Link>
            <Link to="/signup" className="header-button">Sign Up</Link>
          </div>
        )}
      </nav>
    </header>
  );
}
