'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';
import { Shield, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, clearMustChangePassword } = useAuth();

  // Redirect to login if not authenticated
  if (!user) {
    router.replace('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your current password');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      if (res.success) {
        clearMustChangePassword();
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'var(--color-warning, #f59e0b)' }}>
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Change Your Password
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            For security, you must set a new password before continuing.
          </p>
        </div>

        {/* Change Password Card */}
        <div className="rounded-2xl p-8 border"
             style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm border"
                   style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border text-sm pr-11 transition-colors focus:border-[var(--color-primary)]"
                  style={{
                    background: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border text-sm pr-11 transition-colors focus:border-[var(--color-primary)]"
                  style={{
                    background: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Must include uppercase, lowercase, and a number
              </p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:border-[var(--color-primary)]"
                style={{
                  background: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Set New Password
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Edlight Initiative &copy; {new Date().getFullYear()} — Admin access only
        </p>
      </div>
    </div>
  );
}
