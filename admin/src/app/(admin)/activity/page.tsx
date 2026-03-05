'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Globe,
  Mail,
  Monitor,
  RefreshCw,
} from 'lucide-react';
import { securityApi } from '@/lib/api';
import { LoginAttempt, SecurityEvent } from '@/lib/types';
import { timeAgo, formatDateTime } from '@/lib/utils';

type ViewMode = 'timeline' | 'table';

export default function ActivityPage() {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const limit = 20;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await securityApi.loginAttempts({ page, limit, success: success || undefined });
      setAttempts(res.data || []);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, success]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [success]);

  const totalPages = Math.ceil(total / limit);

  const successCount = attempts.filter(a => a.success).length;
  const failedCount = attempts.filter(a => !a.success).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Activity Log</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Login attempts and authentication activity
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border p-5 animate-fade-in stagger-1"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
              style={{ background: 'var(--color-info-light)' }}>
              <Activity className="w-5 h-5" style={{ color: 'var(--color-info)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{total}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Attempts</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-5 animate-fade-in stagger-2"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
              style={{ background: 'var(--color-success-light)' }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{successCount}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Successful (page)</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-5 animate-fade-in stagger-3"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
              style={{ background: 'var(--color-danger-light)' }}>
              <XCircle className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{failedCount}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Failed (page)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Filter className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
        <select
          value={success}
          onChange={(e) => setSuccess(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <option value="">All Attempts</option>
          <option value="true">Successful Only</option>
          <option value="false">Failed Only</option>
        </select>

        <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5"
          style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setViewMode('timeline')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: viewMode === 'timeline' ? 'var(--color-primary)' : 'transparent',
              color: viewMode === 'timeline' ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('table')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: viewMode === 'table' ? 'var(--color-primary)' : 'transparent',
              color: viewMode === 'table' ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            Table
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : attempts.length === 0 ? (
        <div className="rounded-xl border py-16 text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>No activity found</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            No login attempts match your filters
          </p>
        </div>
      ) : viewMode === 'timeline' ? (
        /* ─── Timeline View ─────────────────────────────── */
        <div className="rounded-xl border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="p-6 space-y-0">
            {attempts.map((attempt, index) => {
              const isLast = index === attempts.length - 1;
              return (
                <div key={attempt.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                      style={{ background: attempt.success ? 'var(--color-success)' : 'var(--color-danger)' }} />
                    {!isLast && (
                      <div className="w-px flex-1 my-1" style={{ background: 'var(--color-border)' }} />
                    )}
                  </div>
                  <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-5'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={{
                          background: attempt.success ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                          color: attempt.success ? 'var(--color-success)' : 'var(--color-danger)',
                        }}
                      >
                        {attempt.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {attempt.success ? 'Success' : 'Failed'}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        {formatDateTime(attempt.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {attempt.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                        <code className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                          {attempt.ipAddress}
                        </code>
                      </div>
                    </div>
                    {attempt.failureReason && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                        {attempt.failureReason}
                      </p>
                    )}
                    {attempt.userAgent && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Monitor className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-[11px] truncate max-w-md" style={{ color: 'var(--color-text-muted)' }}>
                          {attempt.userAgent}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ─── Table View ────────────────────────────────── */
        <div className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Email</th>
                  <th>IP Address</th>
                  <th>Reason</th>
                  <th>User Agent</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={{
                          background: a.success ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                          color: a.success ? 'var(--color-success)' : 'var(--color-danger)',
                        }}
                      >
                        {a.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {a.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text)' }}>{a.email}</td>
                    <td>
                      <code className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                        {a.ipAddress}
                      </code>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{a.failureReason || '—'}</td>
                    <td className="max-w-[200px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {a.userAgent || '—'}
                    </td>
                    <td className="whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                      {formatDateTime(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
