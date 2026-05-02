import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginUser, signupUser } from '../services/api';
import { saveAuth } from '../services/auth';

function buildCaptcha() {
  const first = Math.floor(Math.random() * 9) + 1;
  const second = Math.floor(Math.random() * 9) + 1;
  return {
    question: `${first} + ${second}`,
    answer: String(first + second)
  };
}

function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(buildCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const isSignup = mode === 'signup';
  const loginIntent = useMemo(() => new URLSearchParams(location.search).get('intent'), [location.search]);

  useEffect(() => {
    if (!loginIntent) {
      navigate('/home', { replace: true });
      return;
    }

    if (loginIntent === 'signup') {
      setMode('signup');
    } else {
      setMode('login');
    }
  }, [loginIntent, navigate]);

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      setMessage('');

      if (captchaInput.trim() !== captcha.answer) {
        setError('Captcha verification failed. Please try again.');
        setCaptcha(buildCaptcha());
        setCaptchaInput('');
        return;
      }

      setLoading(true);

      const payload = isSignup
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const response = isSignup ? await signupUser(payload) : await loginUser(payload);

      if (isSignup) {
        setMessage(response.message || 'Signup successful');
        setMode('login');
        setCaptcha(buildCaptcha());
        setCaptchaInput('');
        return;
      }

      saveAuth(response.token || '', response.user || {});
      setMessage(response.message || 'Login successful');

      const nextPath = location.state?.from?.pathname || '/dashboard';
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const captchaLabel = useMemo(() => `Solve: ${captcha.question}`, [captcha]);

  return (
    <main className="login-page">
      <section className="panel login-card">
        <div className="login-header">
          <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p>
            {isSignup
              ? 'Join DICOM-AI to access simulation controls, reports, and analytics.'
              : 'Sign in to continue where you left off and run new simulations.'}
          </p>
        </div>

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

          <div className="captcha-row">
            <label className="captcha-label">{captchaLabel}</label>
            <div className="captcha-input-row">
              <input
                placeholder="Answer"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                required
              />
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setCaptcha(buildCaptcha());
                  setCaptchaInput('');
                  setError('');
                }}
              >
                Refresh
              </button>
            </div>
          </div>

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
