import { useState, useEffect } from 'react';
import Button from '../Button/Button';
import TextField from '../TextField/TextField';
import InlineToast from '../InlineToast/InlineToast';
import type { ToastVariant } from '../InlineToast/InlineToast';
import type { PoolType } from '../../../lib/types';

export interface CreateGroupFormValues {
  name: string;
  identifier: string;
  description: string;
  poolType: PoolType;
}

export interface CreateGroupFormProps {
  /**
   * Called on valid submission. Should return a promise that resolves on
   * success or rejects with an Error on failure.
   */
  onSubmit: (values: CreateGroupFormValues) => Promise<void>;
  /** Called when the user clicks Cancel. */
  onCancel?: () => void;
  /**
   * Pre-fill form fields. If `identifier` is set, the Group ID field is
   * locked (not auto-generated from name) and cannot be changed.
   */
  initialValues?: Partial<CreateGroupFormValues> | null;
}

interface FormErrors {
  name?: string;
  identifier?: string;
  description?: string;
}

interface ToastState {
  open: boolean;
  message: string;
  variant: ToastVariant;
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
}

/**
 * CreateGroupForm is a fully controlled form for creating (or editing) a group.
 *
 * - Auto-generates the Group ID slug from the name unless the user manually edits it.
 * - If `initialValues.identifier` is provided the Group ID field is locked.
 * - Manages async submission with an internal loading state.
 * - Displays success/error feedback via InlineToast anchored above the submit button.
 */
export default function CreateGroupForm({
  onSubmit,
  onCancel = () => {},
  initialValues = null,
}: CreateGroupFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [identifier, setIdentifier] = useState(initialValues?.identifier ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [poolType, setPoolType] = useState<PoolType>(initialValues?.poolType ?? 'nfl_weekly');
  const [identifierManuallyEdited, setIdentifierManuallyEdited] = useState(
    !!initialValues?.identifier
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    variant: 'success',
  });

  // Continuously sync identifier from name while not manually edited
  useEffect(() => {
    if (!identifierManuallyEdited) {
      setIdentifier(slugifyName(name));
    }
  }, [name, identifierManuallyEdited]);

  function validateForm(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (name.length < 3) {
      newErrors.name = 'Group name must be at least 3 characters';
    } else if (name.length > 50) {
      newErrors.name = 'Group name must be 50 characters or less';
    }

    if (!identifier.trim()) {
      newErrors.identifier = 'Group ID is required';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(identifier)) {
      newErrors.identifier =
        'Group ID can only contain letters, numbers, hyphens, and underscores';
    } else if (identifier.length < 3) {
      newErrors.identifier = 'Group ID must be at least 3 characters';
    } else if (identifier.length > 30) {
      newErrors.identifier = 'Group ID must be 30 characters or less';
    }

    if (description && description.length > 200) {
      newErrors.description = 'Description must be 200 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSubmit({ name, identifier, description, poolType });
      setToast({ open: true, message: 'Group created!', variant: 'success' });
    } catch (err) {
      setToast({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to create group',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleIdentifierChange(value: string) {
    // If user diverges from auto slug, stop auto-updating
    const expected = slugifyName(name);
    if (value !== expected) {
      setIdentifierManuallyEdited(true);
    }
    setIdentifier(value);
  }

  return (
    <div className="bg-neutral-0 border border-secondary-200 rounded-lg p-6 dark:bg-secondary-800 dark:border-secondary-700">
      <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-50 mb-6">Create New Group</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Group Name"
          value={name}
          onChange={setName}
          placeholder="Enter group name"
          validationMessage={errors.name}
          validationState={errors.name ? 'error' : 'none'}
          required
          disabled={loading}
        />

        <div>
          <TextField
            label="Group ID"
            value={identifier}
            onChange={handleIdentifierChange}
            placeholder="unique-group-id"
            validationMessage={errors.identifier}
            validationState={errors.identifier ? 'error' : 'none'}
            required
            disabled={loading || !!initialValues?.identifier}
          />
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
            {initialValues?.identifier
              ? 'Group ID cannot be changed after creation.'
              : 'This will be used to share your group with others. It must be unique.'}
          </p>
        </div>

        <TextField
          label="Description (Optional)"
          value={description}
          onChange={setDescription}
          placeholder="Describe your group..."
          validationMessage={errors.description}
          validationState={errors.description ? 'error' : 'none'}
          multiline
          disabled={loading}
        />

        <div>
          <label
            htmlFor="pool-type"
            className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1"
          >
            Pool Type
          </label>
          <select
            id="pool-type"
            value={poolType}
            onChange={(e) => setPoolType(e.target.value as PoolType)}
            disabled={loading}
            className="block w-full rounded-md border border-secondary-300 px-3 py-2 text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-secondary-100 disabled:text-secondary-500 dark:bg-secondary-900 dark:border-secondary-600 dark:text-secondary-100"
          >
            <option value="nfl_weekly">NFL Weekly</option>
            <option value="world_cup_2026">World Cup 2026</option>
          </select>
        </div>

        <div className="flex space-x-3 pt-4">
          <div className="relative inline-toast-anchor">
            <Button type="submit" variant="primary" disabled={loading} loading={loading}>
              {loading ? 'Creating...' : 'Create Group'}
            </Button>
            <InlineToast
              open={toast.open}
              message={toast.message}
              variant={toast.variant}
              onClose={() => setToast((t) => ({ ...t, open: false }))}
            />
          </div>

          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
