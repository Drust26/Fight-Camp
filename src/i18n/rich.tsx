// tn('Monthly bills of {amount} are due this week.', { amount: <b>{money(x)}</b> }) — translated sentences with
// React elements (bold numbers, links, icons) inside, in whatever order the language needs them.
import { Fragment, type ReactNode } from 'react';
import { t } from './index';

export function tn(s: string, vars: Record<string, ReactNode>): ReactNode {
  const parts = t(s).split(/(\{\w+\})/);
  return parts.map((p, i) => {
    const m = /^\{(\w+)\}$/.exec(p);
    return <Fragment key={i}>{m && m[1] in vars ? vars[m[1]] : p}</Fragment>;
  });
}
