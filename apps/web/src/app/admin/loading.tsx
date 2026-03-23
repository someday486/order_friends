export default function AdminLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-bg-tertiary" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-xl border border-border bg-bg-secondary"
          />
        ))}
      </div>
      <div className="h-12 rounded-xl border border-border bg-bg-secondary" />
      <div className="rounded-xl border border-border bg-bg-secondary">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-14 border-b border-border last:border-b-0"
          />
        ))}
      </div>
    </div>
  );
}
