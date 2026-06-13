// src/pages/LoginPage.jsx — stub
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerEntity, verifyOTP } from '../api/client';

export default function LoginPage() {
  const [step, setStep]           = useState('register');
  const [displayName, setName]    = useState('');
  const [email, setEmail]         = useState('');
  const [otp, setOtp]             = useState('');
  const [devOtp, setDevOtp]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const { login }                 = useAuth();
  const navigate                  = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await registerEntity({ display_name: displayName, email });
      if (res.data.dev_otp) setDevOtp(res.data.dev_otp);
      setStep('verify');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await verifyOTP({ email, otp });
      login(res.data.token, res.data.entity);
      navigate('/inbox');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full border-2 border-blue-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-blue-600 font-bold text-lg">CB</span>
          </div>
          <h1 className="text-lg font-medium text-gray-900">Chit and Bridge</h1>
          <p className="text-xs text-gray-400 mt-1">
            {step === 'register' ? 'Entity or actor — same screen' : 'Enter your verification code'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {devOtp && (
          <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg mb-4 font-mono">
            DEV OTP: <strong>{devOtp}</strong>
          </div>
        )}

        {step === 'register' ? (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <input
              type="text" placeholder="Entity name" value={displayName}
              onChange={e => setName(e.target.value)} required
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              type="email" placeholder="Email address" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Sending code...' : 'Get verification code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 text-center">Code sent to {email}</p>
            <input
              type="text" placeholder="6-digit code" value={otp}
              onChange={e => setOtp(e.target.value)} maxLength={6} required
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest text-lg focus:outline-none focus:border-blue-500"
            />
            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify and continue'}
            </button>
            <button type="button" onClick={() => setStep('register')}
              className="text-xs text-blue-600 text-center">
              Back
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          Powered By Chit and Bridge
        </p>
      </div>
    </div>
  );
}
