import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import authIllustration from '@/assets/auth-illustration.png';

const LOGO_URL = '/logo.png';

export function LoginPage() {
  const { signIn, isAuthenticated, isLoading, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'auth' | 'access' | 'general'>('general');
  const [loading, setLoading] = useState(false);

  if (!isLoading && isAuthenticated && user?.role === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      setErrorType('general');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() ?? '';
      if (msg.includes('access denied') || msg.includes('admin privileges')) {
        setError('This account is registered as a collector, not an admin. Please use an admin account to access the dashboard.');
        setErrorType('access');
      } else if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('Invalid email or password. Please check your credentials and try again.');
        setErrorType('auth');
      } else if (msg.includes('email not confirmed')) {
        setError('Your email address has not been confirmed. Please check your inbox.');
        setErrorType('general');
      } else if (msg.includes('too many requests') || msg.includes('rate limit')) {
        setError('Too many login attempts. Please wait a moment and try again.');
        setErrorType('general');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('Unable to connect to the server. Please check your internet connection.');
        setErrorType('general');
      } else {
        setError(err?.message || 'An unexpected error occurred. Please try again.');
        setErrorType('general');
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#0A2040] via-[#0D2B52] to-[#152D4A]">
      {/* Left Panel - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#5B9BD5] rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#5B9BD5] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center max-w-md">
          <img
            src={authIllustration}
            alt="Secure authentication"
            className="w-80 h-80 object-contain mx-auto mb-8 drop-shadow-2xl"
          />
          <h2 className="text-2xl font-bold text-white mb-3">
            Admin Control Center
          </h2>
          <p className="text-[#8FAABE]/70 text-sm leading-relaxed">
            Manage your point-of-sale operations, monitor orders, and oversee your team — all in one place.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-[#0D1F33] lg:rounded-l-[2rem]">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-8">
            <img
              src={LOGO_URL}
              alt="Gels Consumer Goods Trading"
              className="w-9 h-9 rounded-xl object-contain shadow-lg"
            />
            <div>
              <h1 className="text-lg font-bold text-[#E8EDF2] leading-tight">
                GELS CONSUMER GOODS TRADING
              </h1>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#E8EDF2]">Welcome back</h2>
            <p className="text-sm text-[#8FAABE]/50 mt-1">
              Sign in to your admin dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`flex items-start gap-3 border rounded-xl p-3.5 mb-5 animate-[fadeIn_0.2s_ease-out] ${
              errorType === 'access'
                ? 'bg-[#E5C07B]/10 border-[#E5C07B]/30'
                : 'bg-[#E06C75]/10 border-[#E06C75]/30'
            }`}>
              {errorType === 'access' ? (
                <ShieldAlert size={18} className="text-[#E5C07B] mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-[#E06C75] mt-0.5 flex-shrink-0" />
              )}
              <p className={`text-sm leading-snug ${
                errorType === 'access' ? 'text-[#E5C07B]' : 'text-[#E06C75]'
              }`}>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#E8EDF2] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setErrorType('general'); }}
                className="w-full border border-[#1E3F5E]/60 rounded-xl px-3.5 py-2.5 text-sm bg-[#162F4D] text-[#E8EDF2]
                  focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]/30 focus:border-[#5B9BD5]
                  placeholder:text-[#8FAABE]/40 transition-colors"
                placeholder="admin@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E8EDF2] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); setErrorType('general'); }}
                  className="w-full border border-[#1E3F5E]/60 rounded-xl px-3.5 py-2.5 pr-10 text-sm bg-[#162F4D] text-[#E8EDF2]
                    focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]/30 focus:border-[#5B9BD5]
                    placeholder:text-[#8FAABE]/40 transition-colors"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8FAABE]/40 hover:text-[#E8EDF2] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#5B9BD5] text-white py-2.5 rounded-xl font-medium text-sm
                hover:bg-[#4A8BC4] active:bg-[#3A7BB4] disabled:opacity-60 disabled:cursor-not-allowed
                shadow-lg shadow-[#5B9BD5]/25 hover:shadow-[#5B9BD5]/40
                transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
