'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  agentColor,
  agentLabel,
  decisionColor,
  decisionLabel,
  phaseColor,
  phaseLabel,
  runStatutColor,
  statutColor,
  statutLabel,
} from '@/lib/ui'

interface BadgeProps {
  className?: string
}

export function StatutBadge({ value, className }: { value: string } & BadgeProps) {
  const c = statutColor(value)
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', c.bg, c.text, 'border-transparent', className)}>
      <span className={cn('inline-block size-1.5 rounded-full', c.dot)} />
      {statutLabel(value)}
    </Badge>
  )
}

export function AgentBadge({ value, className }: { value: string } & BadgeProps) {
  const c = agentColor(value)
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', c.bg, c.text, 'border-transparent', className)}>
      <span className={cn('inline-block size-1.5 rounded-full', c.dot)} />
      {agentLabel(value)}
    </Badge>
  )
}

export function DecisionBadge({ value, className }: { value: string } & BadgeProps) {
  const c = decisionColor(value)
  return (
    <Badge variant="outline" className={cn('font-medium', c.bg, c.text, 'border-transparent', className)}>
      {decisionLabel(value)}
    </Badge>
  )
}

export function PhaseBadge({ value, className }: { value: string } & BadgeProps) {
  const c = phaseColor(value)
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', c.bg, c.text, 'border-transparent', className)}>
      <span className={cn('inline-block size-1.5 rounded-full', c.dot)} />
      {phaseLabel(value)}
    </Badge>
  )
}

export function RunStatutDot({ value, className }: { value: string } & BadgeProps) {
  return (
    <span
      className={cn('inline-block size-2 rounded-full', runStatutColor(value), className)}
      title={value}
      aria-label={`Statut: ${value}`}
    />
  )
}

export function SkillVersionBadge({ value, className }: { value: string } & BadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-[10px] uppercase tracking-wide border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        className,
      )}
    >
      {value}
    </Badge>
  )
}

export function NiveauBadge({ value, className }: { value: string } & BadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-[10px] uppercase border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700',
        className,
      )}
    >
      {value}
    </Badge>
  )
}
