'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  ShieldAlert,
  ShieldOff,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Loader2,
} from 'lucide-react';
import { securityApi, usersApi } from '@/lib/api';
import { SecurityDashboard } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

interface DashboardData {
  security: SecurityDashboard;
  totalUsers: number;
}

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [secRes, usersRes] = await Promise.all([
          securityApi.dashboard(),
          usersApi.list({ limit: 1 }),
        ]);
        setData({
          security: secRes.data!,
          totalUsers: usersRes.pagination.total,
        });
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (!data) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>Failed to load dashboard data.</p>;
  }

  const { security, totalUsers } = data;

  const cards = [
    { label: 'Total Users', value: totalUsers, icon: Users, color: 'var(--color-primary)' },
    { label: 'Successful Logins (24h)', value: security.successfulLoginsLast24h, icon: CheckCircle2, color: 'var(--color-success)' },
    { label: 'Failed Logins (24h)', value: security.failedLoginsLast24h, icon: XCircle, color: 'var(--color-danger)' },
    { label: 'Locked Accounts', value: security.lockedAccounts, icon: Lock, color: 'var(--color-warning)' },
    { label: 'Blocked IPs', value: security.activeBlockedIps, icon: ShieldOff, color: '#f97316' },
    { label: 'Unresolved Alerts', value: security.unresolvedEvents, icon: ShieldAlert, color: 'var(--color-critical)' },
    { label: 'Critical Events', value: security.criticalEvents, icon: AlertTriangle, color: 'var(--color-critical)' },
    { label: 'Total Events', value: security.totalEvents, icon: Activity, color: 'var(--color-text-secondary)' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Real-time platform overview and security status
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5 border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {card.label}
              </span>
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
            </div>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Security Events */}
      <div
        className="rounded-xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Recent Security Events</h2>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Type</th>
                <th>Message</th>
                <th>IP Address</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {security.recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    No security events yet
                  </td>
                </tr>
              ) : (
                security.recentEvents.slice(0, 10).map((event) => (
                  <tr key={event.id}>
                    <td>
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: severityBg[event.severity],
                          color: severityColor[event.severity],
                        }}
                      >
                        {event.severity}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {event.type.replace(/_/g, ' ')}
                    </td>
                    <td className="max-w-xs truncate" style={{ color: 'var(--color-text)' }}>
                      {event.message}
                    </td>
                    <td>
                      <code className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                        {event.ipAddress || '—'}
                      </code>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{timeAgo(event.createdAt)}</td>
                    <td>
                      {event.resolved ? (
                        <span className="text-xs" style={{ color: 'var(--color-success)' }}>Resolved</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-warning)' }}>Open</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
