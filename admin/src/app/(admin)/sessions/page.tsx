'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Globe,
  Monitor,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { securityApi, usersApi } from '@/lib/api';
import { LoginAttempt } from '@/lib/types';
import { timeAgo, formatDateTime } from '@/lib/utils';

export default function SessionsPage() {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const limit = 20;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // Get successful logins to represent sessions
      const res = await securityApi.loginAttempts({ page, limit, success: 'true' });
      setAttempts(res.data || []);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / limit);

  // Parse basic browser info from user agent
  function parseBrowser(ua: string | null): string {
    if (!ua) return 'Unknown';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('curl')) return 'cURL';
    return 'Other';
  }

  function parseOS(ua: string | null): string {
    if (!ua) return 'Unknown';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Other';
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Sessions</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Authenticated sessions and login history
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-primary)',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border p-5 animate-fade-in stagger-1"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-success-light)' }}>
              <Wifi className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{total}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Sessions</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-5 animate-fade-in stagger-2"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-warning-light)' }}>
              <Clock className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                {attempts.length > 0 ? timeAgo(attempts[0].createdAt) : 'N/A'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Last Session</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : attempts.length === 0 ? (
        <div className="rounded-xl border py-16 text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <WifiOff className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>No sessions found</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            No authenticated sessions have been recorded
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((session, index) => {
            const browser = parseBrowser(session.userAgent);
            const os = parseOS(session.userAgent);
            return (
              <div
                key={session.id}
                className={`card-interactive rounded-xl border p-5 animate-fade-in stagger-${Math.min(index + 1, 8)}`}
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--color-primary-light)' }}>
                    <User className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {session.email}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                        <CheckCircle2 className="w-3 h-3" />
                        Authenticated
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                        <code className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                          {session.ipAddress}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {browser} on {os}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {formatDateTime(session.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Time ago */}
                  <div className="text-right shrink-0">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {timeAgo(session.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border disabled:opacity-30 transition-colors"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border disabled:opacity-30 transition-colors"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
