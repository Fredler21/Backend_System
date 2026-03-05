'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreVertical,
  UserCog,
  Trash2,
  Shield,
} from 'lucide-react';
import { usersApi } from '@/lib/api';
import { User, Role } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const roles: Role[] = ['STUDENT', 'DEVELOPER', 'ADMIN'];

const roleBadgeColor: Record<string, { bg: string; text: string }> = {
  ADMIN: { bg: 'rgba(99,102,241,0.12)', text: 'var(--color-primary)' },
  DEVELOPER: { bg: 'rgba(34,197,94,0.12)', text: 'var(--color-success)' },
  STUDENT: { bg: 'rgba(94,94,115,0.12)', text: 'var(--color-text-secondary)' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [roleModal, setRoleModal] = useState<{ user: User; newRole: Role } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page, limit, search: search || undefined, role: roleFilter || undefined });
      setUsers(res.data || []);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const totalPages = Math.ceil(total / limit);

  const handleRoleChange = async () => {
    if (!roleModal) return;
    setActionLoading(true);
    try {
      await usersApi.updateRole(roleModal.user.id, roleModal.newRole);
      setRoleModal(null);
      fetchUsers();
    } catch (err) {
      console.error('Role update error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      await usersApi.delete(userId);
      fetchUsers();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setActionLoading(false);
      setActionMenu(null);
    }
  };

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Users</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Manage platform user accounts, roles, and access
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mb-4 sm:mb-6">
        <div className="relative flex-1 min-w-0 sm:min-w-[240px] sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border text-sm appearance-none cursor-pointer"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {total} user{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
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
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'var(--color-primary)' }}
                          >
                            {user.firstName[0]}{user.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: roleBadgeColor[user.role]?.bg,
                            color: roleBadgeColor[user.role]?.text,
                          }}
                        >
                          {user.role === 'ADMIN' && <Shield className="w-3 h-3" />}
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: user.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: user.isActive ? 'var(--color-success)' : 'var(--color-danger)',
                          }}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="relative">
                          <button
                            onClick={() => setActionMenu(actionMenu === user.id ? null : user.id)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {actionMenu === user.id && (
                            <div
                              className="absolute right-0 top-8 w-48 rounded-lg border shadow-xl py-1 z-50"
                              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                            >
                              <button
                                onClick={() => {
                                  setRoleModal({ user, newRole: user.role });
                                  setActionMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                                style={{ color: 'var(--color-text-secondary)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <UserCog className="w-4 h-4" /> Change Role
                              </button>
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                                style={{ color: 'var(--color-danger)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <Trash2 className="w-4 h-4" /> Delete User
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border disabled:opacity-30"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border disabled:opacity-30"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-full max-w-sm rounded-2xl p-5 sm:p-6 border mx-4 sm:mx-0"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
              Change Role
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Update role for {roleModal.user.firstName} {roleModal.user.lastName}
            </p>

            <select
              value={roleModal.newRole}
              onChange={(e) => setRoleModal({ ...roleModal, newRole: e.target.value as Role })}
              className="w-full px-4 py-2.5 rounded-lg border text-sm mb-5"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setRoleModal(null)}
                className="flex-1 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={actionLoading || roleModal.newRole === roleModal.user.role}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--color-primary)' }}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
