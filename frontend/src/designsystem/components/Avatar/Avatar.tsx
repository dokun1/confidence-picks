import { useState, useEffect } from 'react';

export type AvatarVariant = 'sm' | 'md' | 'lg';
export type AvatarRounded = 'full' | 'base';

export interface AvatarProps {
  /** User's display name — used for initials and alt text. */
  name?: string;
  /** User's email — used for initials when name is absent. */
  email?: string;
  /** URL of the user's profile picture. Falls back to initials when null/undefined. */
  pictureUrl?: string | null;
  /**
   * Explicit pixel size. Deprecated — use `variant` instead.
   * When provided it overrides the `variant` size mapping.
   */
  size?: number | null;
  /** Preset size variant. Maps to fixed pixel dimensions. */
  variant?: AvatarVariant;
  /** Additional Tailwind classes applied to the root element. */
  className?: string;
  /** Border-radius scale: 'full' for circular, 'base' for slightly rounded. */
  rounded?: AvatarRounded;
}

const SIZE_MAP: Record<AvatarVariant, number> = {
  sm: 16,
  md: 32,
  lg: 48,
};

function buildSources(pictureUrl: string, actualSize: number): string[] {
  const base = pictureUrl;
  const variants = new Set<string>();
  variants.add(base);
  if (/=s\d+-c$/.test(base)) {
    // Google profile images — request exactly the size we need
    variants.add(base.replace(/=s\d+-c$/, `=s${actualSize}-c`));
    variants.add(base.replace(/=s\d+-c$/, `=s${actualSize * 2}-c`)); // 2x retina
    variants.add(base.replace(/=s\d+-c$/, ''));
  } else if (!/[?&]sz=/.test(base)) {
    // Other images (Apple, etc.) — append sz param for retina sizing
    variants.add(base + (base.includes('?') ? '&' : '?') + `sz=${actualSize * 2}`);
  }
  return Array.from(variants);
}

function getInitials(name: string, email: string): string {
  return (name || email || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}

/**
 * Avatar displays a user's profile picture with automatic fallback to initials.
 *
 * Supports three preset sizes (sm/md/lg), circular or rounded-base border radius,
 * and graceful degradation through multiple image source variants before showing
 * initials.
 */
export default function Avatar({
  name = '',
  email = '',
  pictureUrl = null,
  size = null,
  variant = 'md',
  className = '',
  rounded = 'full',
}: AvatarProps) {
  const actualSize = size !== null ? size : (SIZE_MAP[variant] ?? SIZE_MAP.md);
  const initials = getInitials(name, email);
  const sources = pictureUrl ? buildSources(pictureUrl, actualSize) : [];

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(!pictureUrl);

  // Reset source state whenever the picture URL or resolved size changes
  useEffect(() => {
    setIndex(0);
    setFailed(!pictureUrl);
  }, [pictureUrl, actualSize]);

  const dimensionClass = `w-[${actualSize}px] h-[${actualSize}px]`;

  function handleError() {
    if (index < sources.length - 1) {
      setIndex(i => i + 1);
    } else {
      setFailed(true);
    }
  }

  if (!failed && sources.length > 0) {
    return (
      <img
        src={sources[index]}
        alt={name || email}
        className={`object-cover ${dimensionClass} rounded-${rounded} border border-primary-100 dark:border-primary-800 ${className}`}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={handleError}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center bg-accent text-accent-fg font-medium ${dimensionClass} rounded-${rounded} ${className}`}>
      {initials}
    </div>
  );
}
