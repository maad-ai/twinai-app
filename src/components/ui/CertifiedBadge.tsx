import { BadgeCheck } from 'lucide-react';

const SIZE_CLASSES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
} as const;

/**
 * "Twiinn Certified" check shown next to a twin's public-facing name.
 * Render only when `twin.certified` is truthy (the column may not exist yet).
 */
export function CertifiedBadge({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-shrink-0 align-middle${className ? ` ${className}` : ''}`}
      title="Twiinn Certified"
    >
      <BadgeCheck
        className={`${SIZE_CLASSES[size]} text-[#A855F7]`}
        aria-label="Twiinn Certified"
        role="img"
      />
    </span>
  );
}
