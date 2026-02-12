export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-border border-t-foreground animate-spin" />
        <span className="text-sm text-text-secondary">로딩 중...</span>
      </div>
    </div>
  );
}
