'use client';

import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  LogOut,
  Shield,
  Loader2,
  Sun,
  Moon,
  Bell,
  Search,
  ChevronDown,
  Activity,
  Settings,
  Clock,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { securityApi } from '@/lib/api';
import type { SecurityEvent } from '@/lib/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'var(--color-primary)' },
  { href: '/users', label: 'Users', icon: Users, color: 'var(--color-accent)' },
  { href: '/security', label: 'Security', icon: ShieldAlert, color: 'var(--color-danger)' },
  { href: '/activity', label: 'Activity', icon: Activity, color: 'var(--color-success)' },
  { href: '/sessions', label: 'Sessions', icon: Clock, color: 'var(--color-warning)' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAdmin, mustChangePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<SecurityEvent[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && !isAdmin) router.replace('/login');
    if (!loading && user && mustChangePassword) router.replace('/change-password');
  }, [user, loading, isAdmin, mustChangePassword, router]);

  // Fetch notifications on mount & every 60s
  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      setNotifLoading(true);
      try {
        const res = await securityApi.events({ limit: 20, resolved: 'false' });
        if (res.success && res.data) setNotifications(res.data);
      } catch {
        setNotifications([]);
      } finally {
        setNotifLoading(false);
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Close profile dropdown on click outside
  useEffect(() => {
    const handler = () => setProfileOpen(false);
    if (profileOpen) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [profileOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg)' }}>
      {/* ─── Sidebar Overlay ─────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ─────────────────────────────────────── */}
      <aside
        className="w-[260px] flex flex-col shrink-0 fixed h-screen z-50 transition-transform duration-300 ease-in-out"
        style={{
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-[15px]" style={{ color: 'var(--sidebar-text-active)' }}>
              Edlight
            </span>
            <span className="text-[10px] font-medium ml-1.5 px-1.5 py-0.5 rounded"
              style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              ADMIN
            </span>
          </div>
          {/* Close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--sidebar-text)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 mb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--sidebar-text)' }} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border-0"
              style={{
                background: 'var(--sidebar-hover)',
                color: 'var(--sidebar-text-active)',
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="px-3 mt-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-3"
            style={{ color: 'var(--sidebar-text)', opacity: 0.5 }}>
            Menu
          </span>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all"
                style={{
                  background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: isActive ? item.color : 'transparent',
                    opacity: isActive ? 1 : 0.7,
                  }}
                >
                  <item.icon className="w-4 h-4" style={{ color: isActive ? '#fff' : 'var(--sidebar-text)' }} />
                </div>
                {item.label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
            >
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-text-active)' }}>
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--sidebar-text)' }}>
                {user.role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Area ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header
          className="h-16 flex items-center justify-between px-8 shrink-0 sticky top-0 z-20"
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold capitalize" style={{ color: 'var(--color-text)' }}>
              {pathname.split('/').pop() || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            {/* Notifications */}
            <button
              onClick={() => { setNotifOpen(true); setProfileOpen(false); }}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Bell className="w-[18px] h-[18px]" />
              {notifications.length > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
                  style={{ background: 'var(--color-danger)' }}
                >
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-8 mx-2" style={{ background: 'var(--color-border)' }} />

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
                >
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {user.firstName}
                </span>
                <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl border py-2 z-50"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => router.push('/change-password')}
                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Settings className="w-4 h-4" /> Change Password
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors"
                      style={{ color: 'var(--color-danger)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-light)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ─── Notification Slide-Over Panel ───────────────── */}
      {notifOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setNotifOpen(false)} />
      )}
      <div
        className="fixed top-0 right-0 h-full z-[70] w-full sm:w-[380px] flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          background: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: notifOpen ? '-4px 0 24px rgba(0,0,0,0.15)' : 'none',
          transform: notifOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Panel Header */}
        <div className="h-16 flex items-center justify-between px-5 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>Notifications</span>
            {notifications.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                {notifications.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setNotifOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto">
          {notifLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'var(--color-surface-hover)' }}>
                <Bell className="w-7 h-7" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>All clear!</p>
              <p className="text-xs mt-1 text-center" style={{ color: 'var(--color-text-muted)' }}>
                No unresolved security events
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((evt) => {
                const severityColor = evt.severity === 'CRITICAL' ? 'var(--color-danger)'
                  : evt.severity === 'HIGH' ? 'var(--color-warning)'
                  : evt.severity === 'MEDIUM' ? 'var(--color-accent)'
                  : 'var(--color-text-muted)';
                return (
                  <div
                    key={evt.id}
                    className="px-5 py-4 transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => { setNotifOpen(false); router.push('/security'); }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: severityColor }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                            {evt.type.replace(/_/g, ' ')}
                          </p>
                          <span className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded"
                            style={{ background: `color-mix(in srgb, ${severityColor} 15%, transparent)`, color: severityColor }}>
                            {evt.severity}
                          </span>
                        </div>
                        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                          {evt.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
                            {new Date(evt.createdAt).toLocaleString()}
                          </span>
                          {evt.ipAddress && (
                            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
                              IP: {evt.ipAddress}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel Footer */}
        {notifications.length > 0 && (
          <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => { setNotifOpen(false); router.push('/security'); }}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white text-center"
              style={{ background: 'var(--color-primary)' }}
            >
              View all in Security
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
