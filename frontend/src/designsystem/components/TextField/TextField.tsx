import { forwardRef, useId, useRef } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export type TextFieldSize = 'sm' | 'md' | 'lg';
export type TextFieldValidationState = 'none' | 'success' | 'error';

export interface TextFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  validationMessage?: string;
  validationState?: TextFieldValidationState;
  disabled?: boolean;
  secure?: boolean;
  showClearButton?: boolean;
  inputType?: 'text' | 'email' | 'password';
  size?: TextFieldSize;
  required?: boolean;
  readOnly?: boolean;
  id?: string;
  multiline?: boolean;
  rows?: number;
}

const SIZE_CLASSES: Record<TextFieldSize, string> = {
  sm: 'px-xs py-xxxs text-sm h-[2rem]',
  md: 'px-sm py-xs text-base h-[2.5rem]',
  lg: 'px-md py-sm text-lg h-[3rem]',
};

const MULTILINE_SIZE_CLASSES: Record<TextFieldSize, string> = {
  sm: 'px-xs py-xxxs text-sm min-h-[4rem]',
  md: 'px-sm py-xs text-base min-h-[5rem]',
  lg: 'px-md py-sm text-lg min-h-[6rem]',
};

const VALIDATION_CLASSES: Record<TextFieldValidationState, string> = {
  none: 'border-secondary-300 focus:border-primary-500 focus:ring-primary-500',
  success: 'border-success-500 focus:border-success-600 focus:ring-success-500',
  error: 'border-error-500 focus:border-error-600 focus:ring-error-500',
};

const DARK_VALIDATION_CLASSES: Record<TextFieldValidationState, string> = {
  none: 'dark:border-secondary-600 dark:focus:border-primary-400 dark:focus:ring-primary-400',
  success: 'dark:border-success-400 dark:focus:border-success-300 dark:focus:ring-success-400',
  error: 'dark:border-error-400 dark:focus:border-error-300 dark:focus:ring-error-400',
};

const MESSAGE_COLOR_CLASSES: Record<TextFieldValidationState, string> = {
  none: 'text-primary-600 dark:text-primary-400',
  success: 'text-success-600 dark:text-success-400',
  error: 'text-error-600 dark:text-error-400',
};

const VALIDATION_ICON: Record<
  TextFieldValidationState,
  React.ComponentType<{ className?: string }>
> = {
  none: InformationCircleIcon,
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
};

function buildInputClasses(
  size: TextFieldSize,
  validationState: TextFieldValidationState,
  multiline: boolean,
  showClear: boolean
): string {
  const sizeClass = multiline ? MULTILINE_SIZE_CLASSES[size] : SIZE_CLASSES[size];
  return [
    'w-full rounded-base border transition-all duration-fast ease-smooth',
    'bg-neutral-0 dark:bg-secondary-800',
    'text-neutral-900 dark:text-neutral-0',
    'placeholder-secondary-400 dark:placeholder-secondary-500',
    'focus:outline-none focus:ring-1 focus:ring-offset-none',
    'disabled:bg-secondary-100 disabled:text-secondary-500 disabled:cursor-not-allowed',
    'dark:disabled:bg-secondary-900 dark:disabled:text-secondary-600',
    sizeClass,
    VALIDATION_CLASSES[validationState],
    DARK_VALIDATION_CLASSES[validationState],
    showClear ? 'pr-xl' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * TextField renders a controlled text input or textarea with label, validation
 * state, an optional clear button, and size variants.
 *
 * Pass `onChange` to receive plain string values on every keystroke.
 * Use `multiline` to render a `<textarea>` instead of an `<input>`.
 */
const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(
  function TextField(
    {
      value = '',
      onChange,
      placeholder = '',
      label = '',
      validationMessage = '',
      validationState = 'none',
      disabled = false,
      secure = false,
      showClearButton = true,
      inputType = 'text',
      size = 'md',
      required = false,
      readOnly = false,
      id: idProp = '',
      multiline = false,
      rows = 3,
    },
    ref
  ) {
    const generatedId = useId();
    const id = idProp || generatedId;
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const hasValue = value.length > 0;
    const actualType = secure ? 'password' : inputType;
    const showClear = showClearButton && hasValue && !disabled && !readOnly && !multiline;

    const inputClasses = buildInputClasses(size, validationState, multiline, showClear);

    const ValidationIcon = VALIDATION_ICON[validationState] ?? VALIDATION_ICON.none;
    const messageColor = MESSAGE_COLOR_CLASSES[validationState];

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
      onChange?.(e.target.value);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (secure && (e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
      }
    }

    function clearValue() {
      onChange?.('');
      (inputRef.current as HTMLElement | null)?.focus();
    }

    // Combine external ref and internal ref
    function setRef(el: HTMLInputElement | HTMLTextAreaElement | null) {
      (inputRef as React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>).current =
        el;
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>).current = el;
      }
    }

    return (
      <div className="text-field-container w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-content-muted mb-xs"
          >
            {label}
            {required && <span className="text-error-500">*</span>}
          </label>
        )}

        <div className="relative">
          {multiline ? (
            <textarea
              ref={setRef as React.RefCallback<HTMLTextAreaElement>}
              id={id}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
              rows={rows}
              className={inputClasses}
              onChange={handleChange}
            />
          ) : (
            <input
              ref={setRef as React.RefCallback<HTMLInputElement>}
              id={id}
              type={actualType}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
              className={inputClasses}
              style={
                secure ? { userSelect: 'none', WebkitUserSelect: 'none' } : undefined
              }
              onChange={handleChange}
              onKeyDown={handleKeyDown}
            />
          )}

          {/* Clear Button */}
          {showClear && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-xs text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200 transition-colors duration-fast"
              onClick={clearValue}
              tabIndex={-1}
            >
              <svg className="w-[1rem] h-[1rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Validation Message */}
        {validationMessage && (
          <div className="flex items-center mt-xs gap-xs">
            <ValidationIcon className={`w-[1rem] h-[1rem] ${messageColor}`} />
            <span className={`${messageColor} text-sm`}>{validationMessage}</span>
          </div>
        )}
      </div>
    );
  }
);

export default TextField;
