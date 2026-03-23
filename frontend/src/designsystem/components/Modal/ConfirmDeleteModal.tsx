import Modal from './Modal';
import Button from '../Button';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
}: ConfirmDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={title}>
      <div className="space-y-md">
        <h3 className="text-xl font-heading font-semibold text-error-600 dark:text-error-400">
          {title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{body}</p>
        <div className="flex justify-end space-x-sm pt-sm">
          <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading} type="button">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDeleteModal;
