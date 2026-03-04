'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, XCircle, AlertTriangle, Lock } from 'lucide-react';

function SetupPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenEmail, setTokenEmail] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Password strength checks
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    match: password.length > 0 && password === confirmPassword,
  };
  const allPassed = Object.values(checks).every(Boolean);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      return;
    }

    adminApi
      .verifyToken(token)
      .then((res) => {
        if (res.success && res.data) {
          setTokenValid(true);
          setTokenEmail(res.data.email);
          setTokenExpiry(res.data.expiresAt);
        }
      })
      .catch((err) => {
        setError(err.message || 'Invalid or expired invitation token');
      })
      .finally(() => setVerifying(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allPassed || !token) return;

    setError('');
    setLoading(true);

    try {
      await adminApi.setupPassword({ token, password, confirmPassword });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  // ─── Loading State ────────────────────────────────────
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Verifying invitation...</p>
        </div>
      </div>
    );
  }

  // ─── No Token ─────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'rgba(239,68,68,0.1)' }}>
            <XCircle className="w-8 h-8" style={{ color: 'var(--color-danger)' }} />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            Missing Invitation Token
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            This page requires a valid invitation link. Please check your email for the invitation sent by an administrator.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--color-primary)' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ─── Invalid/Expired Token ────────────────────────────
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'rgba(245,158,11,0.1)' }}>
            <AlertTriangle className="w-8 h-8" style={{ color: 'var(--color-warning)' }} />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            Invalid Invitation
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            {error || 'This invitation link is invalid or has expired. Please contact an administrator for a new invitation.'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--color-primary)' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ─── Success State ────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'rgba(34,197,94,0.1)' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--color-success)' }} />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            Password Set Successfully
          </h1>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Your admin account is now active. Redirecting to login...
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {tokenEmail}
          </p>
        </div>
      </div>
    );
  }

  // ─── Password Setup Form ─────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'var(--color-primary)' }}>
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Set Your Password
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Complete your admin account setup for
          </p>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-primary)' }}>
            {tokenEmail}
          </p>
        </div>

        {/* Setup Card */}
        <div className="rounded-2xl p-8 border"
             style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm border"
                   style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border text-sm pr-11 transition-colors focus:border-[var(--color-primary)]"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border text-sm pr-11 transition-colors focus:border-[var(--color-primary)]"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="rounded-lg p-4 border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Password Requirements
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: 'length', label: '8+ characters' },
                  { key: 'uppercase', label: 'Uppercase letter' },
                  { key: 'lowercase', label: 'Lowercase letter' },
                  { key: 'number', label: 'Number' },
                  { key: 'special', label: 'Special character' },
                  { key: 'match', label: 'Passwords match' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    {checks[key as keyof typeof checks] ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                    )}
                    <span className="text-xs" style={{
                      color: checks[key as keyof typeof checks] ? 'var(--color-success)' : 'var(--color-text-secondary)',
                    }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !allPassed}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting password...
                </span>
              ) : (
                'Activate Account'
              )}
            </button>
          </form>
        </div>

        {/* Expiry Note */}
        {tokenExpiry && (
          <p className="text-center text-xs mt-4" style={{ color: 'var(--color-text-secondary)' }}>
            This invitation expires on {new Date(tokenExpiry).toLocaleString()}
          </p>
        )}

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-text-secondary)' }}>
          Already set up?{' '}
          <button onClick={() => router.push('/login')} className="underline" style={{ color: 'var(--color-primary)' }}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    }>
      <SetupPasswordForm />
    </Suspense>
  );
}
