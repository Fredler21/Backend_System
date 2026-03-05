'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUpRight,
  Shield,
  Zap,
} from 'lucide-react';
import { securityApi } from '@/lib/api';
import { LoginAttempt } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

type ViewMode = 'trends' | 'timeline' | 'table';

// ─── Helpers ────────────────────────────────────────────

function groupByHour(attempts: LoginAttempt[], hours: number) {
  const now = Date.now();
  const buckets: { label: string; success: number; failed: number; total: number }[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const start = now - (i + 1) * 3600_000;
    const end = now - i * 3600_000;
    const label = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const inRange = attempts.filter(a => {
      const t = new Date(a.createdAt).getTime();
      return t >= start && t < end;
    });
    buckets.push({
      label,
      success: inRange.filter(a => a.success).length,
      failed: inRange.filter(a => !a.success).length,
      total: inRange.length,
    });
  }
  return buckets;
}

function groupByDay(attempts: LoginAttempt[], days: number) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const buckets: { label: string; success: number; failed: number; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const inRange = attempts.filter(a => {
      const t = new Date(a.createdAt).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });
    buckets.push({
      label: dayStr,
      success: inRange.filter(a => a.success).length,
      failed: inRange.filter(a => !a.success).length,
      total: inRange.length,
    });
  }
  return buckets;
}

// ─── SVG Area Chart ─────────────────────────────────────

function AreaChart({
  data,
  dataKey,
  color,
  gradientId,
  height = 200,
}: {
  data: { label: string; success: number; failed: number; total: number }[];
  dataKey: 'success' | 'failed' | 'total';
  color: string;
  gradientId: string;
  height?: number;
}) {
  if (data.length === 0) return null;
  const values = data.map(d => d[dataKey]);
  const max = Math.max(...values, 1);
  const W = 100;
  const H = 100;
  const padT = 5;
  const padB = 5;
  const usableH = H - padT - padB;

  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: padT + usableH - (v / max) * usableH,
  }));

  function smoothPath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) / 2;
      d += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    return d;
  }

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;

  const gridLines = 4;
  const gridYs = Array.from({ length: gridLines }, (_, i) => padT + (usableH / (gridLines - 1)) * i);

  return (
    <div style={{ height }} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridYs.map((y, i) => (
          <line key={i} x1="0" y1={y} x2={W} y2={y} stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.3" />
        ))}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

// ─── Mini Sparkline ─────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 80;
  const H = 28;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (v / max) * (H - 4) - 2,
  }));
  const uid = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cx = (points[i].x + points[i + 1].x) / 2;
    d += ` C ${cx} ${points[i].y}, ${cx} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`;
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`}
        fill={`url(#${uid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Horizontal Bar ─────────────────────────────────────

function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] w-14 text-right shrink-0 font-mono font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <div className="flex-1 h-6 rounded-full overflow-hidden relative" style={{ background: 'var(--color-bg)' }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}dd)` }}
        />
        {value > 0 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold"
            style={{ color: 'var(--color-text-secondary)' }}>
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function ActivityPage() {
  const [allAttempts, setAllAttempts] = useState<LoginAttempt[]>([]);
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('trends');
  const [trendRange, setTrendRange] = useState<'24h' | '7d'>('7d');
  const limit = 20;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [pageRes, allRes] = await Promise.all([
        securityApi.loginAttempts({ page, limit, success: success || undefined }),
        securityApi.loginAttempts({ page: 1, limit: 200 }),
      ]);
      setAttempts(pageRes.data || []);
      setTotal(pageRes.pagination.total);
      setAllAttempts(allRes.data || []);
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

  // ─── Trend computations ─────────────────────────────
  const trendData = useMemo(() => {
    if (trendRange === '24h') return groupByHour(allAttempts, 24);
    return groupByDay(allAttempts, 7);
  }, [allAttempts, trendRange]);

  const totalSuccess = allAttempts.filter(a => a.success).length;
  const totalFailed = allAttempts.filter(a => !a.success).length;
  const successRate = allAttempts.length > 0 ? Math.round((totalSuccess / allAttempts.length) * 100) : 0;

  const hourDist = useMemo(() => {
    const h: number[] = new Array(24).fill(0);
    allAttempts.forEach(a => { h[new Date(a.createdAt).getHours()]++; });
    return h;
  }, [allAttempts]);

  const peakHour = useMemo(() => {
    const maxVal = Math.max(...hourDist);
    const idx = hourDist.indexOf(maxVal);
    return { hour: idx, count: maxVal };
  }, [hourDist]);

  const ipStats = useMemo(() => {
    const map: Record<string, number> = {};
    allAttempts.forEach(a => { map[a.ipAddress] = (map[a.ipAddress] || 0) + 1; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return { unique: sorted.length, top: sorted[0] };
  }, [allAttempts]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Activity Trends</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Login activity analytics &amp; authentication trends
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all self-start"
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

      {/* View Toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1 rounded-xl border p-1"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          {([
            { key: 'trends' as ViewMode, label: 'Trends', icon: BarChart3 },
            { key: 'timeline' as ViewMode, label: 'Timeline', icon: Activity },
            { key: 'table' as ViewMode, label: 'Table', icon: Monitor },
          ]).map(v => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: viewMode === v.key ? 'var(--color-primary)' : 'transparent',
                color: viewMode === v.key ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              <v.icon className="w-3.5 h-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        {viewMode !== 'trends' && (
          <div className="flex items-center gap-2 ml-auto">
            <Filter className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
            <select
              value={success}
              onChange={(e) => setSuccess(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <option value="">All Attempts</option>
              <option value="true">Successful Only</option>
              <option value="false">Failed Only</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : viewMode === 'trends' ? (
        /* ═══════════════════════════════════════════════════
           ─── TRENDS VIEW (Premium) ───────────────────────
           ═══════════════════════════════════════════════════ */
        <div className="space-y-6">

          {/* ─── Stat Cards ────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Activity */}
            <div className="rounded-2xl border p-5 relative overflow-hidden"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-[0.07]"
                style={{ background: 'var(--color-primary)' }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--color-primary-light)' }}>
                <Activity className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--color-text)' }}>{allAttempts.length}</p>
              <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>Total Activity</p>
              <div className="mt-2">
                <Sparkline data={trendData.map(d => d.total)} color="var(--color-primary)" />
              </div>
            </div>

            {/* Success Rate */}
            <div className="rounded-2xl border p-5 relative overflow-hidden"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-[0.07]"
                style={{ background: 'var(--color-success)' }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--color-success-light)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
              </div>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--color-text)' }}>{successRate}%</p>
              <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>Success Rate</p>
              <div className="mt-2">
                <Sparkline data={trendData.map(d => d.success)} color="var(--color-success)" />
              </div>
            </div>

            {/* Failed Logins */}
            <div className="rounded-2xl border p-5 relative overflow-hidden"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-[0.07]"
                style={{ background: 'var(--color-danger)' }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'var(--color-danger-light)' }}>
                <TrendingDown className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
              </div>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--color-text)' }}>{totalFailed}</p>
              <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>Failed Logins</p>
              <div className="mt-2">
                <Sparkline data={trendData.map(d => d.failed)} color="var(--color-danger)" />
              </div>
            </div>

            {/* Unique IPs */}
            <div className="rounded-2xl border p-5 relative overflow-hidden"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-[0.07]"
                style={{ background: 'var(--color-accent)' }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(139,92,246,0.1)' }}>
                <Globe className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
              </div>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--color-text)' }}>{ipStats.unique}</p>
              <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>Unique IPs</p>
              {ipStats.top && (
                <p className="text-[10px] mt-2 truncate" style={{ color: 'var(--color-text-muted)' }}>
                  Top: {ipStats.top[0]} ({ipStats.top[1]}×)
                </p>
              )}
            </div>
          </div>

          {/* ─── Main Chart ────────────────────────────────── */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 pt-6 pb-2 gap-3">
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>Activity Overview</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Login attempts over time
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: 'var(--color-border)' }}>
                <button onClick={() => setTrendRange('24h')}
                  className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                  style={{
                    background: trendRange === '24h' ? 'var(--color-primary)' : 'transparent',
                    color: trendRange === '24h' ? '#fff' : 'var(--color-text-muted)',
                  }}>Last 24h</button>
                <button onClick={() => setTrendRange('7d')}
                  className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                  style={{
                    background: trendRange === '7d' ? 'var(--color-primary)' : 'transparent',
                    color: trendRange === '7d' ? '#fff' : 'var(--color-text-muted)',
                  }}>Last 7 days</button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 px-6 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-success)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Success</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-danger)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Failed</span>
              </div>
            </div>

            {/* Charts */}
            <div className="px-6 space-y-1">
              <AreaChart data={trendData} dataKey="total" color="var(--color-primary)" gradientId="grad-total" height={140} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[10px] font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
                    <CheckCircle2 className="w-3 h-3" /> Successful Logins
                  </p>
                  <AreaChart data={trendData} dataKey="success" color="var(--color-success)" gradientId="grad-success" height={80} />
                </div>
                <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[10px] font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
                    <XCircle className="w-3 h-3" /> Failed Logins
                  </p>
                  <AreaChart data={trendData} dataKey="failed" color="var(--color-danger)" gradientId="grad-failed" height={80} />
                </div>
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between px-6 pt-1 pb-4">
              {trendData
                .filter((_, i) => i % Math.ceil(trendData.length / 6) === 0 || i === trendData.length - 1)
                .map((d, i) => (
                  <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.label}</span>
                ))}
            </div>
          </div>

          {/* ─── Bottom Row ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Peak Hours */}
            <div className="rounded-2xl border p-6"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>Peak Activity Hours</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Hourly distribution
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: 'var(--color-warning-light)' }}>
                  <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
                  <span className="text-[11px] font-bold" style={{ color: 'var(--color-warning)' }}>
                    Peak: {peakHour.hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {hourDist.map((count, h) => {
                  if (count === 0 && hourDist.filter(d => d > 0).length > 8) return null;
                  return (
                    <HorizontalBar
                      key={h}
                      label={`${h.toString().padStart(2, '0')}:00`}
                      value={count}
                      max={peakHour.count}
                      color={h === peakHour.hour ? 'var(--color-warning)' : 'var(--color-primary)'}
                    />
                  );
                })}
                {hourDist.every(d => d === 0) && (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                    No hourly data available
                  </p>
                )}
              </div>
            </div>

            {/* Security Insights */}
            <div className="rounded-2xl border p-6"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
              <h3 className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>Security Insights</h3>

              <div className="space-y-4">
                {/* Ratio bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      Success vs Failure Ratio
                    </span>
                    <span className="text-xs font-bold" style={{
                      color: successRate >= 80 ? 'var(--color-success)' : successRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
                    }}>
                      {successRate}% success
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'var(--color-bg)' }}>
                    <div className="h-full rounded-l-full transition-all duration-700"
                      style={{ width: `${successRate}%`, background: 'linear-gradient(90deg, var(--color-success), #34d399)' }} />
                    <div className="h-full rounded-r-full transition-all duration-700"
                      style={{ width: `${100 - successRate}%`, background: 'linear-gradient(90deg, var(--color-danger), #f87171)' }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px]" style={{ color: 'var(--color-success)' }}>{totalSuccess} success</span>
                    <span className="text-[10px]" style={{ color: 'var(--color-danger)' }}>{totalFailed} failed</span>
                  </div>
                </div>

                {/* Insight cards */}
                <div className="space-y-3 mt-4">
                  <div className="rounded-xl p-4 flex items-center gap-4"
                    style={{ background: 'var(--color-bg)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--color-primary-light)' }}>
                      <Shield className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {totalFailed === 0 ? 'Clean Record' : totalFailed <= 3 ? 'Low Risk' : totalFailed <= 10 ? 'Moderate Activity' : 'High Alert'}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {totalFailed === 0
                          ? 'No failed login attempts detected'
                          : `${totalFailed} failed attempt${totalFailed > 1 ? 's' : ''} across ${ipStats.unique} IP${ipStats.unique > 1 ? 's' : ''}`
                        }
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  </div>

                  <div className="rounded-xl p-4 flex items-center gap-4"
                    style={{ background: 'var(--color-bg)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--color-warning-light)' }}>
                      <Clock className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        Peak Hour: {peakHour.hour.toString().padStart(2, '0')}:00
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {peakHour.count} login attempt{peakHour.count !== 1 ? 's' : ''} during peak
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  </div>

                  {ipStats.top && (
                    <div className="rounded-xl p-4 flex items-center gap-4"
                      style={{ background: 'var(--color-bg)' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(139,92,246,0.1)' }}>
                        <Globe className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                          Most Active IP
                        </p>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                          {ipStats.top[0]} — {ipStats.top[1]} request{ipStats.top[1] > 1 ? 's' : ''}
                        </p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
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
                        <span className="text-[11px] truncate max-w-xs sm:max-w-md" style={{ color: 'var(--color-text-muted)' }}>
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
      {viewMode !== 'trends' && totalPages > 1 && (
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
