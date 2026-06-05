import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from './ProfilePage';

// Mock AuthService so the test never touches the network or window.location.
// authService.js exports `default AuthService`, so the mock matches the
// default-export contract ProfilePage imports against.
vi.mock('../lib/authService.js', () => ({
  default: {
    updateUserName: vi.fn(),
    logout: vi.fn(),
  },
}));

// Stub useAuth so ProfilePage renders without the full provider stack. The
// hook is re-stubbed per test where the user shape matters.
const setAuthUser = vi.fn();
const baseUser = {
  id: 1,
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  pictureUrl: null,
  provider: 'google',
};
let currentUser: typeof baseUser | null = baseUser;

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, setAuthUser }),
}));

import AuthService from '../lib/authService.js';

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { ...baseUser };
  });

  it('renders the heading, name, email, and capitalized provider', () => {
    render(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'My Profile' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    // provider 'google' is displayed capitalized.
    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('renders a fallback when no user is present', () => {
    currentUser = null;
    render(<ProfilePage />);
    expect(screen.getByText('No user data.')).toBeInTheDocument();
  });

  it('saves a new name via updateUserName and pushes the result to setAuthUser', async () => {
    const updated = { ...baseUser, name: 'Ada B. Lovelace' };
    vi.mocked(AuthService.updateUserName).mockResolvedValue(updated);

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const input = screen.getByPlaceholderText('Enter your name') as HTMLInputElement;
    expect(input.value).toBe('Ada Lovelace');
    fireEvent.change(input, { target: { value: 'Ada B. Lovelace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(AuthService.updateUserName)).toHaveBeenCalledWith('Ada B. Lovelace');
    });
    expect(setAuthUser).toHaveBeenCalledWith(updated);
    // Edit mode exits — the input is gone.
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter your name')).not.toBeInTheDocument();
    });
  });

  it('cancels editing without calling the service and restores the original name', () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const input = screen.getByPlaceholderText('Enter your name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Throwaway' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(vi.mocked(AuthService.updateUserName)).not.toHaveBeenCalled();
    expect(setAuthUser).not.toHaveBeenCalled();
    // Back to read-only view showing the original name.
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter your name')).not.toBeInTheDocument();
  });

  it('surfaces an inline toast when updateUserName rejects', async () => {
    vi.mocked(AuthService.updateUserName).mockRejectedValue(new Error('Name already taken'));

    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByPlaceholderText('Enter your name'), {
      target: { value: 'Grace Hopper' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name already taken')).toBeInTheDocument();
    expect(setAuthUser).not.toHaveBeenCalled();
  });

  it('logs out via AuthService.logout', () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(vi.mocked(AuthService.logout)).toHaveBeenCalledTimes(1);
  });
});
