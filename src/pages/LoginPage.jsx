// src/pages/LoginPage.jsx — One screen two tabs Login and Register
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerEntity, verifyOTP, actorLogin } from '../api/client';

export default function LoginPage() {
  const [tab, setTab]         = useState('login');
  const [step, setStep]       = useState('credentials');
  const [displayName, setName]= useState('');
  const [username, setUsername]= useState('');
  const [otp, setOtp]         = useState('');
  const [devOtp, setDevOtp]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { login }             = useAuth();
  const navigate              = useNavigate();

  // Detect actor format ravik@yogit
  const isActorFormat = username.includes('@') && username.split('@').length === 2;

  const handleGetCode = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (tab === 'register') {
        // New entity registration
        const res = await registerEntity({ display_name: displayName, email: username });
        if (res.data.dev_otp) setDevOtp(res.data.dev_otp);
        setStep('otp');
      } else {
        // Login — existing entity or actor
        // Actor format: ravik@yogit
        // Entity format: yogit
        const res = await registerEntity({
          display_name: isActorFormat ? username.split('@')[0] : username,
          email: username
        });
        if (res.data.dev_otp) setDevOtp(res.data.dev_otp);
        setStep('otp');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed — please try again');
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let res;
      if (isActorFormat) {
        // Actor login — POST /api/actors/login
        res = await actorLogin({ username: username.toLowerCase(), otp });
        login(res.data.token, res.data.actor);
      } else {
        // Entity login
        res = await verifyOTP({ email: username, otp });
        login(res.data.token, res.data.entity);
      }
      navigate('/inbox');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect code — try again');
    } finally { setLoading(false); }
  };

  const reset = () => {
    setStep('credentials');
    setOtp(''); setDevOtp(''); setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full border-2 border-blue-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-blue-600 font-bold text-base">CB</span>
          </div>
          <h1 className="text-base font-medium text-gray-900">Chit and Bridge</h1>
          <p className="text-xs text-gray-400 mt-0.5">Business execution platform</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg mb-4 border border-red-200">
            {error}
          </div>
        )}

        {step === 'credentials' ? (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              {['login','register'].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); }}
                  className={`flex-1 py-2.5 text-xs font-medium border-b-2 capitalize transition-colors ${
                    tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                  }`}>
                  {t === 'login' ? 'Login' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleGetCode} className="flex flex-col gap-3">
              {tab === 'register' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Entity name</label>
                  <input type="text" placeholder="Your business name"
                    value={displayName} onChange={e => setName(e.target.value)} required
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-blue-500"/>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  {tab === 'login' ? 'Username' : 'Email address'}
                </label>
                <input
                  type={tab === 'register' ? 'email' : 'text'}
                  placeholder={tab === 'login' ? 'yogit  or  ravik@yogit' : 'email@example.com'}
                  value={username} onChange={e => setUsername(e.target.value)} required
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-blue-500"/>
                {tab === 'login' && username.length > 2 && (
                  <div className={`text-xs mt-1 px-2 py-1 rounded ${
                    isActorFormat
                      ? 'bg-green-50 text-green-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {isActorFormat
                      ? `Employee login detected — ${username.split('@')[0]} under ${username.split('@')[1]}`
                      : 'Entity login detected'
                    }
                  </div>
                )}
              </div>

              <button type="submit" disabled={loading}
                className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 mt-1">
                {loading ? 'Sending code...' : 'Get verification code'}
              </button>
            </form>

            {/* Hint */}
            <div className="text-center mt-4">
              {tab === 'login' ? (
                <p className="text-xs text-gray-400">
                  New here?{' '}
                  <button onClick={() => setTab('register')} className="text-blue-600">Create entity</button>
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  Already registered?{' '}
                  <button onClick={() => setTab('login')} className="text-blue-600">Login</button>
                </p>
              )}
            </div>
          </>
        ) : (
          /* OTP Step */
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <div className="text-center">
              <div className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-3 ${
                isActorFormat ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {isActorFormat ? '👤 Employee' : '🏢 Entity'} — {username}
              </div>
              <p className="text-xs text-gray-500">Enter your verification code</p>
            </div>

            {/* Dev OTP amber box */}
            {devOtp && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg text-center">
                <div className="text-amber-600 text-xs mb-1">Dev mode — use this code</div>
                <div className="font-mono font-bold text-xl tracking-widest">{devOtp}</div>
              </div>
            )}

            <input
              type="text" placeholder="6-digit code"
              value={otp} onChange={e => setOtp(e.target.value)}
              maxLength={6} required
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:border-blue-500"/>

            <button type="submit" disabled={loading || otp.length !== 6}
              className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify and continue'}
            </button>

            <button type="button" onClick={reset}
              className="text-xs text-blue-600 text-center">
              ← Back
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-5">
          Powered by Chit and Bridge
        </p>
      </div>
    </div>
  );
}
