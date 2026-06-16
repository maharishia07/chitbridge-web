// src/pages/LoginPage.jsx — PIN aware login
// Entity: email or name → OTP → in
// Actor: ravik@athi (no dot after @) → first time OTP → set PIN → next time PIN
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerEntity, verifyOTP, actorLogin, checkActorLogin } from '../api/client';

export default function LoginPage() {
  const [tab, setTab]           = useState('login');
  const [step, setStep]         = useState('username'); // username | otp | pin
  const [displayName, setName]  = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp]           = useState('');
  const [pin, setPin]           = useState('');
  const [devOtp, setDevOtp]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [actorHasPin, setActorHasPin] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState('');
  const { login }               = useAuth();
  const navigate                = useNavigate();

  // Actor format: ravik@yogit — no dot in part after @
  // Entity email: athi@test.com — has dot in part after @
  // Entity name: Athi — no @ at all
  const atParts = username.split('@');
  const isActorFormat = username.includes('@') && atParts.length === 2 && !atParts[1].includes('.');

  const handleNext = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (tab === 'register') {
        const res = await registerEntity({ display_name: displayName, email: username, mode: 'register' });
        if (res.data.dev_otp) setDevOtp(res.data.dev_otp);
        if (res.data.email) setResolvedEmail(res.data.email);
        setStep('otp');
      } else if (isActorFormat) {
        // Actor login — check if PIN is set
        const res = await checkActorLogin(username);
        if (!res.data.valid) {
          setError('Co-assist not found — check username and entity name');
          return;
        }
        if (res.data.has_pin) {
          setActorHasPin(true);
          setStep('pin'); // returning actor — ask for PIN
        } else {
          setActorHasPin(false);
          setStep('otp'); // first time — ask for OTP from admin
          setDevOtp('123456');
        }
      } else {
        // Entity login — only allows existing accounts
        const res = await registerEntity({ display_name: username, email: username, mode: 'login' });
        if (res.data.dev_otp) setDevOtp(res.data.dev_otp);
        if (res.data.email) setResolvedEmail(res.data.email);
        setStep('otp');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (isActorFormat) {
        const res = await actorLogin({ username: username.toLowerCase(), otp });
        login(res.data.token, res.data.actor);
        navigate(res.data.requires_pin_setup ? '/set-pin' : '/inbox');
      } else {
        const res = await verifyOTP({ email: resolvedEmail || username, otp });
        login(res.data.token, res.data.entity);
        navigate('/inbox');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect code — try again');
    } finally { setLoading(false); }
  };

  const handlePinLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await actorLogin({ username: username.toLowerCase(), pin });
      login(res.data.token, res.data.actor);
      navigate('/inbox');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect PIN');
    } finally { setLoading(false); }
  };

  const reset = () => {
    setStep('username'); setOtp(''); setPin('');
    setDevOtp(''); setError(''); setActorHasPin(false); setResolvedEmail('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 w-full max-w-sm">

        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full border-2 border-blue-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-blue-600 font-bold text-base">CB</span>
          </div>
          <h1 className="text-base font-medium text-gray-900">Chit and Bridge</h1>
          <p className="text-xs text-gray-400 mt-0.5">Business execution platform</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg mb-4 border border-red-200">
            {error}
          </div>
        )}

        {/* ── USERNAME STEP ── */}
        {step === 'username' && (
          <>
            <div className="flex border-b border-gray-200 mb-4">
              {['login','register'].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); setUsername(''); }}
                  className={`flex-1 py-2.5 text-xs font-medium border-b-2 capitalize transition-colors ${
                    tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                  }`}>
                  {t === 'login' ? 'Login' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleNext} className="flex flex-col gap-3">
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
                  placeholder={tab === 'login' ? 'athi@test.com  or  ravik@athi' : 'email@example.com'}
                  value={username} onChange={e => setUsername(e.target.value)} required
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-blue-500"/>
                {tab === 'login' && username.length > 2 && (
                  <div className={`text-xs mt-1.5 px-2.5 py-1.5 rounded-lg ${
                    isActorFormat ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {isActorFormat
                      ? `👤 Co-Assist — ${atParts[0]} under ${atParts[1]}`
                      : '🏢 Entity login'
                    }
                  </div>
                )}
              </div>
              <button type="submit" disabled={loading}
                className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 mt-1">
                {loading ? 'Checking...' : 'Continue →'}
              </button>
            </form>

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
        )}

        {/* ── OTP STEP ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="flex flex-col gap-3">
            <div className="text-center mb-2">
              <div className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-2 ${
                isActorFormat ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {isActorFormat ? '👤 Co-Assist' : '🏢 Entity'} — {username}
              </div>
              <p className="text-xs text-gray-500">
                {isActorFormat ? 'Enter the OTP your admin shared with you' : 'Enter your verification code'}
              </p>
            </div>

            {devOtp && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg text-center">
                <div className="text-amber-600 text-xs mb-1">Dev mode — use this code</div>
                <div className="font-mono font-bold text-2xl tracking-widest">{devOtp}</div>
              </div>
            )}

            <input type="text" placeholder="6-digit code"
              value={otp} onChange={e => setOtp(e.target.value)}
              maxLength={6} required
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:border-blue-500"/>

            <button type="submit" disabled={loading || otp.length !== 6}
              className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify and continue'}
            </button>
            <button type="button" onClick={reset} className="text-xs text-blue-600 text-center">← Back</button>
          </form>
        )}

        {/* ── PIN STEP ── */}
        {step === 'pin' && (
          <form onSubmit={handlePinLogin} className="flex flex-col gap-3">
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-2 bg-green-50 text-green-700">
                👤 Co-Assist — {username}
              </div>
              <p className="text-xs text-gray-500">Enter your 4 digit PIN</p>
            </div>

            <input type="password" inputMode="numeric"
              placeholder="• • • •"
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
              maxLength={4} required
              className="border border-gray-300 rounded-lg px-3 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-green-500"/>

            <button type="submit" disabled={loading || pin.length !== 4}
              className="bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button type="button" onClick={reset} className="text-xs text-blue-600 text-center">← Back</button>
            <div className="text-center">
              <button type="button"
                onClick={() => { setStep('otp'); setActorHasPin(false); setDevOtp('123456'); }}
                className="text-xs text-gray-400 underline">
                Forgot PIN? Use OTP from admin
              </button>
            </div>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-5">Powered by Chit and Bridge</p>
      </div>
    </div>
  );
}
