'use client'

import { AlertCircle, RefreshCw, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function LoadingState({ message = 'Chargement…', className }: { message?: string; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <p className="sr-only">{message}</p>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20">
      <CardContent className="flex flex-col items-start gap-3 py-4">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
          <AlertCircle className="size-5" />
          <span className="font-medium">Une erreur est survenue</span>
        </div>
        <p className="text-sm text-rose-700/80 dark:text-rose-300/80">{message}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            <RefreshCw className="size-3.5" />
            Réessayer
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: typeof Inbox
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <Icon className="size-6" />
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  )
}
