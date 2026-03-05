'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldOff,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  Filter,
  Ban,
  Globe,
} from 'lucide-react';
import { securityApi } from '@/lib/api';
import { SecurityEvent, LoginAttempt, BlockedIp, SecuritySeverity, SecurityEventType } from '@/lib/types';
import { timeAgo, formatDateTime } from '@/lib/utils';

type Tab = 'events' | 'logins' | 'blocked';

const severityColor: Record<string, string> = {
  LOW: 'var(--color-text-muted)',
  MEDIUM: 'var(--color-warning)',
  HIGH: '#f97316',
  CRITICAL: 'var(--color-critical)',
};

const severityBg: Record<string, string> = {
  LOW: 'rgba(94,94,115,0.1)',
  MEDIUM: 'rgba(245,158,11,0.1)',
  HIGH: 'rgba(249,115,22,0.1)',
  CRITICAL: 'rgba(220,38,38,0.1)',
};

const severities: SecuritySeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const eventTypes: SecurityEventType[] = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
  'IP_BLOCKED', 'IP_UNBLOCKED', 'BRUTE_FORCE_DETECTED', 'SUSPICIOUS_ACTIVITY',
  'PASSWORD_CHANGED', 'RATE_LIMIT_EXCEEDED', 'UNAUTHORIZED_ACCESS',
];

export default function SecurityPage() {
  const [tab, setTab] = useState<Tab>('events');

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Security</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Audit logs, login monitoring, and IP management
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 sm:gap-1 mb-4 sm:mb-6 border-b overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
        {([
          { key: 'events' as Tab, label: 'Audit Events', icon: ShieldAlert },
          { key: 'logins' as Tab, label: 'Login Attempts', icon: Lock },
          { key: 'blocked' as Tab, label: 'Blocked IPs', icon: ShieldOff },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 -mb-[1px] transition-colors whitespace-nowrap"
            style={{
              borderColor: tab === t.key ? 'var(--color-primary)' : 'transparent',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'events' && <EventsTab />}
      {tab === 'logins' && <LoginsTab />}
      {tab === 'blocked' && <BlockedTab />}
    </div>
  );
}

// ─── Events Tab ─────────────────────────────────────────

function EventsTab() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [type, setType] = useState('');
  const [resolved, setResolved] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 15;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await securityApi.events({
        page,
        limit,
        severity: severity || undefined,
        type: type || undefined,
        resolved: resolved || undefined,
      });
      setEvents(res.data || []);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, [page, severity, type, resolved]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { setPage(1); }, [severity, type, resolved]);

  const totalPages = Math.ceil(total / limit);

  const handleResolve = async (eventId: string) => {
    try {
      await securityApi.resolveEvent(eventId);
      fetchEvents();
    } catch (err) {
      console.error('Resolve error:', err);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-4">
        <Filter className="w-4 h-4 hidden sm:block" style={{ color: 'var(--color-text-muted)' }} />
        <select
          value={severity} onChange={(e) => setSeverity(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm w-full sm:w-auto"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <option value="">All Severities</option>
          {severities.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={type} onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm w-full sm:w-auto"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <option value="">All Types</option>
          {eventTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>

        <select
          value={resolved} onChange={(e) => setResolved(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm w-full sm:w-auto"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <option value="">All Status</option>
          <option value="true">Resolved</option>
          <option value="false">Unresolved</option>
        </select>

        <span className="text-sm ml-auto" style={{ color: 'var(--color-text-muted)' }}>
          {total} event{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>IP</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>No events found</td></tr>
                ) : events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ background: severityBg[ev.severity], color: severityColor[ev.severity] }}>
                        {ev.severity}
                      </span>
                    </td>
                    <td className="whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{ev.type.replace(/_/g, ' ')}</td>
                    <td className="max-w-xs truncate" style={{ color: 'var(--color-text)' }}>{ev.message}</td>
                    <td>
                      <code className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                        {ev.ipAddress || '—'}
                      </code>
                    </td>
                    <td className="whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(ev.createdAt)}</td>
                    <td>
                      {ev.resolved ? (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
                          <CheckCircle className="w-3 h-3" /> Resolved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleResolve(ev.id)}
                          className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

// ─── Logins Tab ─────────────────────────────────────────

function LoginsTab() {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 15;

  const fetchAttempts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await securityApi.loginAttempts({ page, limit, success: success || undefined });
      setAttempts(res.data || []);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load login attempts:', err);
    } finally {
      setLoading(false);
    }
  }, [page, success]);

  useEffect(() => { fetchAttempts(); }, [fetchAttempts]);
  useEffect(() => { setPage(1); }, [success]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          <select
            value={success} onChange={(e) => setSuccess(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 rounded-lg border text-sm"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <option value="">All Attempts</option>
          <option value="true">Successful</option>
          <option value="false">Failed</option>
          </select>
        </div>
        <span className="text-sm sm:ml-auto" style={{ color: 'var(--color-text-muted)' }}>
          {total} attempt{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : (
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
                {attempts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>No login attempts found</td></tr>
                ) : attempts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: a.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: a.success ? 'var(--color-success)' : 'var(--color-danger)',
                        }}
                      >
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
                    <td className="whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{formatDateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
    </div>
  );
}

// ─── Blocked IPs Tab ────────────────────────────────────

function BlockedTab() {
  const [ips, setIps] = useState<BlockedIp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [blockModal, setBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({ ipAddress: '', reason: '', duration: '60' });
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 15;

  const fetchIps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await securityApi.blockedIps({ page, limit, activeOnly: 'true' });
      setIps(res.data || []);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load blocked IPs:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchIps(); }, [fetchIps]);

  const totalPages = Math.ceil(total / limit);

  const handleBlock = async () => {
    setActionLoading(true);
    try {
      await securityApi.blockIp(blockForm.ipAddress, blockForm.reason, parseInt(blockForm.duration));
      setBlockModal(false);
      setBlockForm({ ipAddress: '', reason: '', duration: '60' });
      fetchIps();
    } catch (err) {
      console.error('Block error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    if (!confirm(`Unblock IP ${ip}?`)) return;
    try {
      await securityApi.unblockIp(ip);
      fetchIps();
    } catch (err) {
      console.error('Unblock error:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {total} blocked IP{total !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setBlockModal(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white"
          style={{ background: 'var(--color-danger)' }}
        >
          <Ban className="w-4 h-4" /> Block IP
        </button>
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Reason</th>
                  <th>Blocked At</th>
                  <th>Expires</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {ips.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
                    <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No blocked IPs
                  </td></tr>
                ) : ips.map((ip) => (
                  <tr key={ip.id}>
                    <td>
                      <code className="text-sm px-2 py-1 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                        {ip.ipAddress}
                      </code>
                    </td>
                    <td className="max-w-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{ip.reason}</td>
                    <td className="whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{formatDateTime(ip.blockedAt)}</td>
                    <td className="whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                      {ip.permanent ? 'Permanent' : ip.expiresAt ? formatDateTime(ip.expiresAt) : '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleUnblock(ip.ipAddress)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-success)' }}
                      >
                        <Unlock className="w-3 h-3" /> Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}

      {/* Block IP Modal */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-full max-w-sm rounded-2xl p-5 sm:p-6 border mx-4 sm:mx-0"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Block IP Address</h3>

            <div className="space-y-3 mb-5">
              <input
                value={blockForm.ipAddress}
                onChange={(e) => setBlockForm({ ...blockForm, ipAddress: e.target.value })}
                placeholder="IP Address (e.g. 192.168.1.100)"
                className="w-full px-4 py-2.5 rounded-lg border text-sm"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
              <input
                value={blockForm.reason}
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                placeholder="Reason for blocking"
                className="w-full px-4 py-2.5 rounded-lg border text-sm"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
              <input
                type="number"
                value={blockForm.duration}
                onChange={(e) => setBlockForm({ ...blockForm, duration: e.target.value })}
                placeholder="Duration (minutes)"
                className="w-full px-4 py-2.5 rounded-lg border text-sm"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBlockModal(false)}
                className="flex-1 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={actionLoading || !blockForm.ipAddress || !blockForm.reason}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--color-danger)' }}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Pagination ──────────────────────────────────

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 rounded-lg border disabled:opacity-30"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 rounded-lg border disabled:opacity-30"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
