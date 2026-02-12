type Props = { className?: string; size?: number };

export function StoreIcon({ className, size = 20 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3h18l-2 6H5L3 3z" />
      <path d="M5 9v12h14V9" />
      <path d="M9 21V13h6v8" />
      <path d="M5 9a3 3 0 0 0 3.5 2.96A3 3 0 0 0 12 9a3 3 0 0 0 3.5 2.96A3 3 0 0 0 19 9" />
    </svg>
  );
}
