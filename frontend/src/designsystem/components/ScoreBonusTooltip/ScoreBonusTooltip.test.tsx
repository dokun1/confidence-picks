import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import ScoreBonusTooltip from './ScoreBonusTooltip';

const STORAGE_KEY = 'wc-score-bonus-tooltip-seen';

describe('ScoreBonusTooltip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('when hasKnockoutMatches is false', () => {
    it('renders nothing', () => {
      const { container } = render(<ScoreBonusTooltip hasKnockoutMatches={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('first visit (flag not set)', () => {
    it('auto-opens the tooltip on first render', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('sets the localStorage flag on first render', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    });

    it('shows the score bonus explanation text', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      expect(screen.getByText(/exact score = \+2/)).toBeInTheDocument();
    });

    it('shows a dismiss button', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    });

    it('dismissing closes the tooltip', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('dismissing sets the localStorage flag', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      // Flag is already set on mount, but verify dismiss also calls setItem.
      localStorage.clear();
      fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
      expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    });
  });

  describe('returning visit (flag already set)', () => {
    beforeEach(() => {
      localStorage.setItem(STORAGE_KEY, '1');
    });

    it('does not auto-open when the flag is set', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('renders the ℹ️ info button', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      expect(screen.getByRole('button', { name: 'Score bonus info' })).toBeInTheDocument();
    });

    it('clicking the ℹ️ button opens the tooltip', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      fireEvent.click(screen.getByRole('button', { name: 'Score bonus info' }));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('clicking the ℹ️ button again (toggle) closes the tooltip', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      const infoBtn = screen.getByRole('button', { name: 'Score bonus info' });
      fireEvent.click(infoBtn); // open
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      fireEvent.click(infoBtn); // close
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('the ℹ️ button sets aria-expanded to false when tooltip is closed', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      const infoBtn = screen.getByRole('button', { name: 'Score bonus info' });
      expect(infoBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('the ℹ️ button sets aria-expanded to true when tooltip is open', () => {
      render(<ScoreBonusTooltip hasKnockoutMatches />);
      const infoBtn = screen.getByRole('button', { name: 'Score bonus info' });
      fireEvent.click(infoBtn);
      expect(infoBtn).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
