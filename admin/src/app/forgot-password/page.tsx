'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Shield, ArrowLeft, Loader2, Mail, KeyRound, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import Link from 'next/link';

type Step = 'email' | 'code' | 'new-password' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  // Step 1: Request reset code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setMessage('If an account with that email exists, a verification code has been sent.');
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the 6-digit code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.verifyResetCode(email, code);
      if (res.success && res.data) {
        setResetToken(res.data.resetToken);
        setStep('new-password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Password must contain uppercase, lowercase, and a number');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(resetToken, newPassword);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'var(--color-primary)' }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Reset Password
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {step === 'email' && 'Enter your email to receive a verification code'}
            {step === 'code' && 'Enter the 6-digit code sent to your email'}
            {step === 'new-password' && 'Create a new secure password'}
            {step === 'success' && 'Your password has been reset'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 border"
             style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm border mb-5"
                 style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          {message && step === 'code' && (
            <div className="rounded-lg px-4 py-3 text-sm border mb-5"
                 style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)', color: 'var(--color-success)' }}>
              {message}
            </div>
          )}

          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm transition-colors"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--color-primary)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Verification Code
              </button>
            </form>
          )}

          {/* Step 2: Verify Code */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm text-center tracking-[0.5em] font-mono font-bold text-lg transition-colors"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--color-primary)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Verify Code
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); setMessage(''); }}
                className="w-full py-2 text-sm transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Didn&apos;t receive a code? Try again
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 'new-password' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-11 py-2.5 rounded-lg border text-sm transition-colors"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm transition-colors"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
              </div>

              {/* Password requirements */}
              <div className="text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                <p style={{ color: newPassword.length >= 8 ? 'var(--color-success)' : undefined }}>
                  {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                </p>
                <p style={{ color: /[A-Z]/.test(newPassword) ? 'var(--color-success)' : undefined }}>
                  {/[A-Z]/.test(newPassword) ? '✓' : '○'} One uppercase letter
                </p>
                <p style={{ color: /[a-z]/.test(newPassword) ? 'var(--color-success)' : undefined }}>
                  {/[a-z]/.test(newPassword) ? '✓' : '○'} One lowercase letter
                </p>
                <p style={{ color: /\d/.test(newPassword) ? 'var(--color-success)' : undefined }}>
                  {/\d/.test(newPassword) ? '✓' : '○'} One number
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--color-primary)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Reset Password
              </button>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-2"
                   style={{ background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle className="w-8 h-8" style={{ color: 'var(--color-success)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                Your password has been reset successfully. You can now log in with your new password.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full py-2.5 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: 'var(--color-primary)' }}
              >
                Go to Login
              </button>
            </div>
          )}
        </div>

        {/* Back to login link */}
        {step !== 'success' && (
          <div className="text-center mt-4">
            <Link href="/login" className="text-sm inline-flex items-center gap-1 transition-colors hover:underline"
                  style={{ color: 'var(--color-text-secondary)' }}>
              <ArrowLeft className="w-3 h-3" /> Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
