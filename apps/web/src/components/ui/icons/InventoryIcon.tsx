type Props = { className?: string; size?: number };

export function InventoryIcon({ className, size = 20 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="7" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
      <line x1="14" y1="16" x2="21" y2="16" />
      <line x1="14" y1="20" x2="21" y2="20" />
    </svg>
  );
}
