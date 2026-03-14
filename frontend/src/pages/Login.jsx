import { useState } from 'react';
import { loginUser, signupUser } from '../services/api';

function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isSignup = mode === 'signup';

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');
      setMessage('');

      const payload = isSignup
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const response = isSignup ? await signupUser(payload) : await loginUser(payload);

      localStorage.setItem('dicom_ai_auth_token', response.token || '');
      localStorage.setItem('dicom_ai_user', JSON.stringify(response.user || {}));
      setMessage(response.message || (isSignup ? 'Signup successful' : 'Login successful'));

      if (isSignup) {
        setMode('login');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>{isSignup ? 'Sign Up' : 'Login'}</h1>
      <section className="panel login-card">
        <p>{isSignup ? 'Create your account to access DICOM-AI workflows.' : 'Sign in to continue to the dashboard.'}</p>

        <div className="auth-toggle-row">
          <button
            type="button"
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setMode('login');
              setError('');
              setMessage('');
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setMode('signup');
              setError('');
              setMessage('');
            }}
          >
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {isSignup && (
            <input
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;
