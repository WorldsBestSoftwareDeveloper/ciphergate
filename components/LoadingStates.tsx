export function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-muted/30" />
        <div className="w-12 h-4 rounded bg-muted/30" />
      </div>
      <div className="w-3/4 h-5 rounded bg-muted/30 mb-2" />
      <div className="w-1/2 h-3 rounded bg-muted/20 mb-4" />
      <div className="flex gap-2 mb-4">
        <div className="w-16 h-5 rounded-full bg-muted/20" />
        <div className="w-16 h-5 rounded-full bg-muted/20" />
      </div>
      <div className="flex items-center justify-between">
        <div className="w-20 h-8 rounded bg-muted/30" />
        <div className="w-20 h-9 rounded-xl bg-muted/30" />
      </div>
    </div>
  )
}

export function SkeletonLine({ width = 'full' }: { width?: string }) {
  return <div className={`h-4 rounded bg-muted/30 animate-pulse w-${width}`} />
}

export function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
