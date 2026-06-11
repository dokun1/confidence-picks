import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../designsystem/components/Button';
import Card from '../designsystem/components/Card';

// Ported from the inline Home view in the original App.svelte (commit d6b2566^).
// A marketing landing: welcome header, three feature cards, and a "Get Started"
// section whose CTAs branch on auth state. Content only — Navigation lives in
// Layout, so this page never renders the nav itself.

interface Feature {
  title: string;
  description: string;
  /** Tailwind classes for the icon tile background. */
  iconWrapper: string;
  /** Tailwind classes for the icon color. */
  iconColor: string;
  /** Heroicons-style outline path for the feature icon. */
  iconPath: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Weekly Games',
    description: 'Browse games by week or tournament stage and make a pick for every matchup.',
    iconWrapper: 'bg-primary-100 dark:bg-primary-900',
    iconColor: 'text-primary-600 dark:text-primary-400',
    iconPath:
      'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  },
  {
    title: 'Confidence Picks',
    description: 'Rank your picks by confidence level and earn points based on your accuracy.',
    iconWrapper: 'bg-success-100 dark:bg-success-900',
    iconColor: 'text-success-600 dark:text-success-400',
    iconPath:
      'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  },
  {
    title: 'Leaderboards',
    description: 'Compete with friends and track your ranking all season — or all tournament — long.',
    iconWrapper: 'bg-warning-100 dark:bg-warning-900',
    iconColor: 'text-warning-600 dark:text-warning-400',
    iconPath:
      'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.018 9.018 0 01-2.48 5.228m2.48-5.492a46.95 46.95 0 01-2.48-.546M18.75 4.236v1.516c-.822-.1-1.653-.184-2.48-.546',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center space-y-lg">
        <header className="space-y-md">
          <h1 className="text-4xl font-heading font-bold text-content">
            Welcome to Confidence Picks!
          </h1>
          <p className="text-xl text-content-muted max-w-2xl mx-auto">
            Your home for sports pick&apos;em pools — from NFL confidence picks to the World Cup.
            Compete with friends, track your performance, and climb the leaderboard.
          </p>
        </header>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {FEATURES.map((feature) => (
            <Card key={feature.title} padding="md">
              <div
                className={`w-12 h-12 ${feature.iconWrapper} rounded-base flex items-center justify-center mx-auto mb-sm`}
              >
                <svg
                  className={`w-6 h-6 ${feature.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d={feature.iconPath}
                  />
                </svg>
              </div>
              <h3 className="text-lg font-heading font-semibold text-content mb-xs">
                {feature.title}
              </h3>
              <p className="text-content-muted text-sm">{feature.description}</p>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="space-y-md">
          <h2 className="text-2xl font-heading font-semibold text-content">
            Get Started
          </h2>
          <div className="flex flex-col sm:flex-row gap-sm justify-center">
            {isAuthenticated ? (
              <>
                <Button variant="primary" onClick={() => navigate('/groups')}>
                  View Your Groups
                </Button>
                <Button variant="secondary" onClick={() => navigate('/create-group')}>
                  Create New Group
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => navigate('/login')}>
                  Sign In to Get Started
                </Button>
                <Button variant="secondary" onClick={() => navigate('/login')}>
                  Browse Groups
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
