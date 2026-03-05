'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Zap,
  Eye,
  UserPlus,
  ShieldCheck,
  RefreshCw,
  Clock,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { securityApi, usersApi } from '@/lib/api';
import { LoginAttempt, SecurityDashboard, SecurityEvent } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

interface DashboardData {
  security: SecurityDashboard;
  totalUsers: number;
  activityPattern: number[];
}

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  LOW: { color: 'var(--color-info)', bg: 'var(--color-info-light)', label: 'Low' },
  MEDIUM: { color: 'var(--color-warning)', bg: 'var(--color-warning-light)', label: 'Medium' },
  HIGH: { color: 'var(--color-orange)', bg: 'var(--color-orange-light)', label: 'High' },
  CRITICAL: { color: 'var(--color-critical)', bg: 'var(--color-critical-light)', label: 'Critical' },
};

// ─── Mini Bar Chart Component ──────────────────────────
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-10">
      {data.map((val, i) => (
        <div
          key={i}
          className="w-[6px] rounded-sm transition-all duration-500"
          style={{
            height: `${(val / max) * 100}%`,
            background: color,
            opacity: 0.3 + (i / data.length) * 0.7,
            minHeight: '2px',
          }}
        />
      ))}
    </div>
  );
}

// ─── Donut Chart Component ─────────────────────────────
function DonutChart({ segments, size = 80 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="var(--color-border)" strokeWidth="6" />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dashLength = pct * circumference;
        const el = (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={seg.color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={-offset}
            className="transition-all duration-1000"
          />
        );
        offset += dashLength;
        return el;
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [secRes, usersRes] = await Promise.all([
        securityApi.dashboard(),
        usersApi.list({ limit: 1 }),
      ]);

      // Fetch login attempts separately so a failure doesn't break the dashboard
      let buckets = new Array(12).fill(0);
      try {
        const attemptsRes = await securityApi.loginAttempts({ page: 1, limit: 200 });
        const now = Date.now();
        const attempts = attemptsRes.data ?? [];
        for (const a of attempts) {
          const hoursAgo = (now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
          if (hoursAgo >= 0 && hoursAgo < 12) {
            buckets[11 - Math.floor(hoursAgo)] += 1;
          }
        }
      } catch (e) {
        console.warn('Failed to load login attempts for activity chart:', e);
      }

      setData({
        security: secRes.data!,
        totalUsers: usersRes.pagination.total,
        activityPattern: buckets,
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>Failed to load dashboard data.</p>;
  }

  const { security, totalUsers, activityPattern } = data;
  const loginTotal = security.successfulLoginsLast24h + security.failedLoginsLast24h;
  const loginSuccessRate = loginTotal > 0 ? Math.round((security.successfulLoginsLast24h / loginTotal) * 100) : 100;

  // Stat card definitions — each navigates to a detail view
  const statCards = [
    {
      label: 'Total Users',
      value: totalUsers,
      icon: Users,
      color: 'var(--color-primary)',
      bg: 'var(--color-primary-light)',
      href: '/users',
      trend: '+12%',
      trendUp: true,
      description: 'Registered accounts',
    },
    {
      label: 'Successful Logins',
      value: security.successfulLoginsLast24h,
      icon: CheckCircle2,
      color: 'var(--color-success)',
      bg: 'var(--color-success-light)',
      href: '/security?tab=logins&success=true',
      trend: `${loginSuccessRate}%`,
      trendUp: true,
      description: 'Last 24 hours',
    },
    {
      label: 'Failed Attempts',
      value: security.failedLoginsLast24h,
      icon: XCircle,
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-light)',
      href: '/security?tab=logins&success=false',
      trend: security.failedLoginsLast24h > 5 ? 'High' : 'Normal',
      trendUp: security.failedLoginsLast24h <= 5,
      description: 'Last 24 hours',
    },
    {
      label: 'Locked Accounts',
      value: security.lockedAccounts,
      icon: Lock,
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-light)',
      href: '/users?filter=locked',
      trend: security.lockedAccounts > 0 ? 'Active' : 'None',
      trendUp: security.lockedAccounts === 0,
      description: 'Currently locked',
    },
    {
      label: 'Blocked IPs',
      value: security.activeBlockedIps,
      icon: ShieldOff,
      color: 'var(--color-orange)',
      bg: 'var(--color-orange-light)',
      href: '/security?tab=blocked',
      trend: security.activeBlockedIps > 0 ? 'Active' : 'Clear',
      trendUp: security.activeBlockedIps === 0,
      description: 'Active blocks',
    },
    {
      label: 'Security Alerts',
      value: security.unresolvedEvents,
      icon: ShieldAlert,
      color: 'var(--color-critical)',
      bg: 'var(--color-critical-light)',
      href: '/security?tab=events&resolved=false',
      trend: security.unresolvedEvents > 0 ? 'Unresolved' : 'Clear',
      trendUp: security.unresolvedEvents === 0,
      description: 'Need attention',
    },
  ];

  // Donut data for event severity breakdown
  const severityBreakdown = [
    { value: security.criticalEvents, color: 'var(--color-critical)', label: 'Critical' },
    { value: security.unresolvedEvents, color: 'var(--color-warning)', label: 'Unresolved' },
    { value: Math.max(security.totalEvents - security.criticalEvents - security.unresolvedEvents, 0), color: 'var(--color-success)', label: 'Resolved' },
  ];

  const totalActivity = activityPattern.reduce((s, v) => s + v, 0);

  // Quick actions
  const quickActions = [
    { label: 'View Users', icon: Users, color: 'var(--color-primary)', href: '/users' },
    { label: 'Security Events', icon: ShieldAlert, color: 'var(--color-danger)', href: '/security' },
    { label: 'Login History', icon: Eye, color: 'var(--color-accent)', href: '/security?tab=logins' },
    { label: 'Block IP', icon: Globe, color: 'var(--color-orange)', href: '/security?tab=blocked' },
  ];

  return (
    <div>
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Real-time platform overview and security monitoring
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
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

      {/* ─── Stat Cards Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card, index) => (
          <button
            key={card.label}
            onClick={() => router.push(card.href)}
            className={`card-interactive rounded-xl p-5 border text-left animate-fade-in stagger-${index + 1}`}
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: card.bg }}
              >
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  background: card.trendUp ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                  color: card.trendUp ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {card.trend}
              </div>
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
              {card.value.toLocaleString()}
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {card.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {card.description}
            </p>
          </button>
        ))}
      </div>

      {/* ─── Charts Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Login Success Rate */}
        <button
          onClick={() => router.push('/activity')}
          className="rounded-xl border p-6 animate-fade-in stagger-7 text-left transition-all card-interactive"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Login Success Rate</h3>
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <DonutChart segments={[
                { value: security.successfulLoginsLast24h, color: 'var(--color-success)', label: 'Success' },
                { value: security.failedLoginsLast24h, color: 'var(--color-danger)', label: 'Failed' },
              ]} size={90} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{loginSuccessRate}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-success)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Success: {security.successfulLoginsLast24h}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-danger)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Failed: {security.failedLoginsLast24h}
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Event Severity Breakdown */}
        <button
          onClick={() => router.push('/security')}
          className="rounded-xl border p-6 animate-fade-in stagger-7 text-left transition-all card-interactive"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Event Severity</h3>
            <ShieldAlert className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
          </div>
          <div className="flex items-center gap-6">
            <DonutChart segments={severityBreakdown} size={90} />
            <div className="space-y-2">
              {severityBreakdown.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {seg.label}: {seg.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </button>

        {/* Activity Pattern */}
        <button
          onClick={() => router.push('/activity')}
          className="rounded-xl border p-6 animate-fade-in stagger-8 text-left transition-all card-interactive"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Activity Trend</h3>
            <Activity className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          </div>
          <MiniBarChart data={activityPattern} color="var(--color-primary)" />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{totalActivity} events · Last 12h</span>
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
              View Trends <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      </div>

      {/* ─── Quick Actions + Security Alerts ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Quick Actions */}
        <div className="rounded-xl border p-6"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            <Zap className="w-4 h-4 inline mr-2" style={{ color: 'var(--color-warning)' }} />
            Quick Actions
          </h3>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${action.color}15` }}>
                  <action.icon className="w-4 h-4" style={{ color: action.color }} />
                </div>
                {action.label}
                <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Security Alerts Panel */}
        <div className="lg:col-span-3 rounded-xl border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Security Alerts</h3>
              {security.unresolvedEvents > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                  {security.unresolvedEvents} unresolved
                </span>
              )}
            </div>
            <button
              onClick={() => router.push('/security')}
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: 'var(--color-primary)' }}
            >
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {security.recentEvents.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-success)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>All clear</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>No security events to report</p>
              </div>
            ) : (
              security.recentEvents.slice(0, 5).map((event) => {
                const sev = severityConfig[event.severity] || severityConfig.LOW;
                return (
                  <div
                    key={event.id}
                    className="px-6 py-3.5 flex items-center gap-4 transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--color-border)' }}
                    onClick={() => router.push('/security')}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: sev.bg }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: sev.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {event.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {event.message}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: sev.bg, color: sev.color }}>
                        {sev.label}
                      </span>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {timeAgo(event.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── Recent Activity Timeline ────────────────────── */}
      <div className="rounded-xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Recent Activity</h3>
          </div>
          <button
            onClick={() => router.push('/activity')}
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: 'var(--color-primary)' }}
          >
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="p-6">
          {security.recentEvents.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No recent activity
            </p>
          ) : (
            <div className="space-y-0">
              {security.recentEvents.slice(0, 8).map((event, index) => {
                const sev = severityConfig[event.severity] || severityConfig.LOW;
                const isLast = index === Math.min(security.recentEvents.length, 8) - 1;
                return (
                  <div key={event.id} className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                        style={{ background: sev.color }} />
                      {!isLast && (
                        <div className="w-px flex-1 my-1" style={{ background: 'var(--color-border)' }} />
                      )}
                    </div>
                    {/* Content */}
                    <div className={`pb-${isLast ? '0' : '4'} flex-1 min-w-0`}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {event.type.replace(/_/g, ' ')}
                        </p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: sev.bg, color: sev.color }}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {event.message}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {event.ipAddress && (
                          <code className="text-[11px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                            {event.ipAddress}
                          </code>
                        )}
                        <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          {timeAgo(event.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
