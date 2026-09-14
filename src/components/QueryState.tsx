import type { ReactNode } from 'react';

/** Loading and error states for one data section; renders `children` once its data has arrived. */
export function QueryState<T>({
  query,
  tall = false,
  children,
}: {
  query: { data: T | undefined; isError: boolean; refetch: () => unknown };
  /** Reserve chart height, so the card does not collapse while loading. */
  tall?: boolean;
  children: (data: T) => ReactNode;
}) {
  const className = tall ? 'source-state source-state--tall' : 'source-state';
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) {
    return (
      <div className={className} role="alert">
        <div className="source-state__title">Couldn't load this data</div>
        <div className="source-state__detail">
          The server did not answer.{' '}
          <button type="button" className="link-inline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  return <div className={className} aria-busy="true" />;
}
