import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Select from './Select';

const OPTIONS = [
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
];

describe('Select', () => {
  it('renders every option', () => {
    render(<Select value="" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('option', { name: 'Venmo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cash App' })).toBeInTheDocument();
  });

  it('associates the label with the control', () => {
    render(
      <Select id="method" label="How do members pay?" value="" onChange={() => {}} options={OPTIONS} />,
    );
    expect(screen.getByLabelText('How do members pay?')).toBeInTheDocument();
  });

  it('reflects the current value', () => {
    render(<Select id="m" label="Method" value="cashapp" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByLabelText('Method')).toHaveValue('cashapp');
  });

  it('reports the chosen value', async () => {
    const onChange = vi.fn();
    render(<Select id="m" label="Method" value="" onChange={onChange} options={OPTIONS} />);
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'venmo');
    expect(onChange).toHaveBeenCalledWith('venmo');
  });

  it('renders the placeholder as a selectable empty option', () => {
    render(
      <Select value="" onChange={() => {}} options={OPTIONS} placeholder="Select a method…" />,
    );
    expect(screen.getByRole('option', { name: 'Select a method…' })).toHaveValue('');
  });

  it('renders helper text and links it to the control', () => {
    render(
      <Select
        id="m"
        label="Method"
        value=""
        onChange={() => {}}
        options={OPTIONS}
        helperText="Members see only this option."
      />,
    );
    expect(screen.getByText('Members see only this option.')).toBeInTheDocument();
    expect(screen.getByLabelText('Method')).toHaveAttribute('aria-describedby', 'm-helper');
  });

  it('can be disabled', () => {
    render(<Select id="m" label="Method" value="" onChange={() => {}} options={OPTIONS} disabled />);
    expect(screen.getByLabelText('Method')).toBeDisabled();
  });
});
