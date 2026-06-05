import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthService from '../lib/authService.js';
import Avatar from '../designsystem/components/Avatar';
import Button from '../designsystem/components/Button';
import TextField from '../designsystem/components/TextField';
import InlineToast from '../designsystem/components/InlineToast';
import type { ToastVariant } from '../designsystem/components/InlineToast';

interface ToastState {
  open: boolean;
  message: string;
  variant: ToastVariant;
}

function capitalize(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ProfilePage() {
  const { user, setAuthUser } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    variant: 'error',
  });

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-sm py-xl sm:px-lg text-center text-[var(--color-text-secondary)]">
        No user data.
      </div>
    );
  }

  function startEditingName() {
    setNewName(user!.name || '');
    setEditingName(true);
  }

  function cancelEditingName() {
    setNewName('');
    setEditingName(false);
  }

  async function saveNewName() {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === user!.name) {
      cancelEditingName();
      return;
    }

    setSavingName(true);
    try {
      const updatedUser = await AuthService.updateUserName(trimmed);
      // updateUserName may omit provider; keep the existing one so the context
      // User (provider required) stays well-formed.
      setAuthUser({ ...updatedUser, provider: updatedUser.provider ?? user!.provider });
      setEditingName(false);
      setNewName('');
    } catch (err) {
      setToast({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to update name',
        variant: 'error',
      });
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-sm py-lg sm:px-lg space-y-xl">
      <header className="flex flex-col sm:flex-row items-center sm:items-end gap-md">
        <Avatar
          name={user.name}
          email={user.email}
          pictureUrl={user.pictureUrl}
          variant="lg"
          className="w-16 h-16 md:w-20 md:h-20 border-4 border-primary-100 dark:border-primary-800 shadow-md flex-shrink-0"
        />
        <div className="text-center sm:text-left space-y-sm">
          <h1 className="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
            My Profile
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Manage your account details and preferences.
          </p>
        </div>
      </header>

      <section className="p-lg rounded-base border border-secondary-200 dark:border-secondary-700 bg-neutral-0 dark:bg-secondary-800 space-y-md">
        <h2 className="text-xl font-heading font-semibold text-[var(--color-text-primary)]">
          Account Details
        </h2>
        <div className="space-y-sm text-sm">
          {/* Name (editable) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs">
            <span className="text-[var(--color-text-secondary)]">Name</span>
            {editingName ? (
              <div className="flex flex-col gap-xs sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <TextField
                    value={newName}
                    onChange={setNewName}
                    placeholder="Enter your name"
                    size="sm"
                    disabled={savingName}
                  />
                </div>
                <div className="flex gap-xs">
                  <div className="relative inline-toast-anchor">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveNewName}
                      disabled={savingName}
                      loading={savingName}
                    >
                      {savingName ? 'Saving...' : 'Save'}
                    </Button>
                    <InlineToast
                      open={toast.open}
                      message={toast.message}
                      variant={toast.variant}
                      onClose={() => setToast((t) => ({ ...t, open: false }))}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={cancelEditingName}
                    disabled={savingName}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-xs">
                <span className="font-medium text-[var(--color-text-primary)]">
                  {user.name || '—'}
                </span>
                <Button variant="tertiary" size="sm" onClick={startEditingName}>
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs">
            <span className="text-[var(--color-text-secondary)]">Email</span>
            <span className="font-medium text-[var(--color-text-primary)] break-all">
              {user.email}
            </span>
          </div>

          {/* Provider (read-only) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs">
            <span className="text-[var(--color-text-secondary)]">Provider</span>
            <span className="font-medium text-[var(--color-text-primary)]">
              {capitalize(user.provider || 'google')}
            </span>
          </div>
        </div>
      </section>

      <section className="flex justify-start">
        <Button variant="destructive" onClick={() => AuthService.logout()}>
          Logout
        </Button>
      </section>
    </div>
  );
}
