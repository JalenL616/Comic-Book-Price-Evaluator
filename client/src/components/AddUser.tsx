import React, { useState, useEffect } from 'react';

// Use the environment variable from Vite
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface User {
  id: number;
  name: string;
  email: string;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Function to fetch users from Railway
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  // Fetch users on component load
  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. Function to add a user
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/add-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      if (!response.ok) throw new Error('Failed to add user');

      setName('');
      setEmail('');
      fetchUsers(); // Refresh the list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <section style={{ marginBottom: '40px', padding: '20px', backgroundColor: '#f4f4f9', borderRadius: '8px' }}>
        <h3>Add User to Postgres</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: '8px' }}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '8px' }}
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {loading ? 'Saving...' : 'Add User'}
          </button>
        </form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </section>

      <section>
        <h3>Current Users (from DB)</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {users.map(user => (
            <li key={user.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
              <strong>{user.name}</strong> — {user.email}
            </li>
          ))}
          {users.length === 0 && <p>No users found. Add one above!</p>}
        </ul>
      </section>
    </div>
  );
};