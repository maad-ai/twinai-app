const SIZE_CLASSES = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-20 h-20',
} as const;

const TEXT_CLASSES = {
  sm: 'text-[10px] font-700',
  md: 'text-sm font-700',
  lg: 'text-lg font-800',
  xl: 'text-3xl font-800',
} as const;

const VARIANT_CLASSES = {
  brand: {
    circle: 'bg-gradient-to-br from-[#A855F7] to-[#00D4FF]',
    initial: 'text-white',
  },
  neutral: {
    circle: 'bg-[#F1F5F9]',
    initial: 'text-[#94A3B8]',
  },
} as const;

export function Avatar({
  name,
  size = 'md',
  variant = 'brand',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'brand' | 'neutral';
  className?: string;
}) {
  const v = VARIANT_CLASSES[variant];
  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full ${v.circle} flex items-center justify-center flex-shrink-0${className ? ` ${className}` : ''}`}
    >
      <span className={`${v.initial} ${TEXT_CLASSES[size]}`}>{name.charAt(0)}</span>
    </div>
  );
}
