import { cx } from '../utils/cx'

export interface SkeletonProps {
  className?: string
}

/** Neutral loading block. Always give it an explicit height/width class. */
export function Skeleton({ className }: SkeletonProps) {
  return <span className={cx('block animate-pulse rounded bg-sunken', className)} aria-hidden="true" />
}

export interface SkeletonTextProps {
  /** Number of lines. The last line is rendered short. */
  lines?: number
  className?: string
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={cx('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cx('h-3', index === lines - 1 ? 'w-2/5' : 'w-full')}
        />
      ))}
    </span>
  )
}

export interface SkeletonRowProps {
  /** Cells to render. */
  columns?: number
  className?: string
}

/** A single table row's worth of placeholder cells (inside your own `<tr>`/flex row). */
export function SkeletonRow({ columns = 4, className }: SkeletonRowProps) {
  return (
    <span className={cx('flex items-center gap-4', className)} aria-hidden="true">
      {Array.from({ length: columns }, (_, index) => (
        <Skeleton key={index} className="h-3 flex-1" />
      ))}
    </span>
  )
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cx('rounded-panel border border-line bg-surface p-4', className)}>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="mt-3 h-5 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/2" />
    </div>
  )
}
