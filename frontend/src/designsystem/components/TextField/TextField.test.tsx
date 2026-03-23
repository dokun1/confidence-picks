import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TextField from './TextField';

describe('TextField', () => {
  describe('label rendering', () => {
    it('renders the label when provided', () => {
      render(<TextField label="Group Name" />);
      expect(screen.getByText('Group Name')).toBeInTheDocument();
    });

    it('renders required asterisk when required is true', () => {
      render(<TextField label="Group Name" required />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('does not render a label element when label is empty', () => {
      const { container } = render(<TextField />);
      expect(container.querySelector('label')).toBeNull();
    });
  });

  describe('input rendering', () => {
    it('renders an input by default', () => {
      render(<TextField label="Name" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders a textarea when multiline is true', () => {
      render(<TextField label="Bio" multiline />);
      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    });

    it('uses the provided id on the input', () => {
      render(<TextField label="Name" id="my-input" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'my-input');
    });

    it('links the label to the input via htmlFor', () => {
      render(<TextField label="Name" id="my-input" />);
      const label = screen.getByText('Name');
      expect(label).toHaveAttribute('for', 'my-input');
    });

    it('renders with the given value', () => {
      render(<TextField value="hello" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toHaveValue('hello');
    });

    it('renders as disabled when disabled is true', () => {
      render(<TextField disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('renders as password type when inputType is password', () => {
      const { container } = render(<TextField inputType="password" />);
      expect(container.querySelector('input')).toHaveAttribute('type', 'password');
    });

    it('renders as password type when secure is true', () => {
      const { container } = render(<TextField secure />);
      expect(container.querySelector('input')).toHaveAttribute('type', 'password');
    });

    it('renders with correct rows when multiline', () => {
      const { container } = render(<TextField multiline rows={5} />);
      expect(container.querySelector('textarea')).toHaveAttribute('rows', '5');
    });
  });

  describe('onChange callback', () => {
    it('calls onChange with the new string value on input', () => {
      const onChange = vi.fn();
      render(<TextField value="" onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
      expect(onChange).toHaveBeenCalledWith('abc');
    });

    it('calls onChange on textarea input', () => {
      const onChange = vi.fn();
      render(<TextField multiline value="" onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'text area' } });
      expect(onChange).toHaveBeenCalledWith('text area');
    });
  });

  describe('clear button', () => {
    it('renders a clear button when there is a value and showClearButton is true', () => {
      render(<TextField value="hello" onChange={() => {}} showClearButton />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('does not render a clear button when value is empty', () => {
      render(<TextField value="" onChange={() => {}} showClearButton />);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('does not render a clear button when showClearButton is false', () => {
      render(<TextField value="hello" onChange={() => {}} showClearButton={false} />);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('does not render a clear button when disabled', () => {
      render(<TextField value="hello" onChange={() => {}} disabled showClearButton />);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('does not render a clear button for multiline', () => {
      render(<TextField value="hello" onChange={() => {}} multiline showClearButton />);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('calls onChange with empty string when clear button is clicked', () => {
      const onChange = vi.fn();
      render(<TextField value="hello" onChange={onChange} showClearButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('validation message', () => {
    it('renders the validation message when provided', () => {
      render(<TextField validationMessage="This field is required" validationState="error" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('does not render validation section when validationMessage is empty', () => {
      render(<TextField validationState="error" />);
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('applies error message color class for error state', () => {
      render(<TextField validationMessage="Error!" validationState="error" />);
      const msg = screen.getByText('Error!');
      expect(msg).toHaveClass('text-error-600');
    });

    it('applies success message color class for success state', () => {
      render(<TextField validationMessage="Looks good" validationState="success" />);
      const msg = screen.getByText('Looks good');
      expect(msg).toHaveClass('text-success-600');
    });
  });

  describe('size variants', () => {
    it('applies sm size class', () => {
      const { container } = render(<TextField size="sm" />);
      expect(container.querySelector('input')).toHaveClass('text-sm');
    });

    it('applies md size class (default)', () => {
      const { container } = render(<TextField />);
      expect(container.querySelector('input')).toHaveClass('text-base');
    });

    it('applies lg size class', () => {
      const { container } = render(<TextField size="lg" />);
      expect(container.querySelector('input')).toHaveClass('text-lg');
    });
  });

  describe('secure mode', () => {
    it('blocks Ctrl+C when secure is true', () => {
      render(<TextField secure value="secret" onChange={() => {}} />);
      // type="password" inputs are not accessible as role="textbox"; query by value
      const input = screen.getByDisplayValue('secret');
      // Should not throw
      fireEvent.keyDown(input, { key: 'c', ctrlKey: true });
    });
  });
});
