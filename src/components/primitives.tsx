import type { ReactNode } from 'react';
import type { ChipTone } from '../lib/theme';
import { toneStyle } from '../lib/theme';

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span className="chip" style={toneStyle(tone)}>
      {children}
    </span>
  );
}

export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  large = false,
  actions,
}: {
  title: string;
  subtitle: string;
  large?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className={large ? 'page-title page-title--lg' : 'page-title'}>{title}</div>
        <div className={large ? 'page-subtitle page-subtitle--lg' : 'page-subtitle'}>{subtitle}</div>
      </div>
      {actions}
    </div>
  );
}

export function Bar({
  size = 'md',
  pct,
  color = 'var(--blue)',
}: {
  size?: 'thin' | 'md' | 'thick';
  pct: number;
  color?: string;
}) {
  return (
    <div className={`bar bar--${size}`}>
      <div className="bar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Field({
  label,
  children,
  variant = 'default',
}: {
  label: string;
  children: ReactNode;
  variant?: 'default' | 'body' | 'metric';
}) {
  const valueClass =
    variant === 'body'
      ? 'field-value field-value--body'
      : variant === 'metric'
        ? 'field-value--metric'
        : 'field-value';
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className={valueClass}>{children}</div>
    </div>
  );
}
