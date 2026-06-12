import { createRoot } from 'react-dom/client';
import './app.css';
import WorldCupGamesList from './designsystem/components/WorldCupBrowse/WorldCupGamesList';
import { mockBrowseGames, MOCK_NOW } from './lib/mockWorldCupData';

// Local prototype host: mounts the REAL browse components against mock data.
// (Throwaway dev harness — not part of the shipped app.)

createRoot(document.getElementById('preview')!).render(
  <div className="min-h-screen bg-secondary-50 px-md py-lg dark:bg-secondary-950">
    <WorldCupGamesList initialGames={mockBrowseGames} now={MOCK_NOW} />
  </div>,
);
