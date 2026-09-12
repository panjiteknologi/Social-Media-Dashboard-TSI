import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Whether a change replaces the current history entry or pushes a new one.
 *
 * View toggles (chart range, tab) use 'replace' so the back button leaves the
 * screen rather than stepping through every filter the user tried. Opening a
 * detail drawer pushes, so back closes it — the gesture people expect.
 */
type HistoryMode = 'replace' | 'push';

function useParamWriter(key: string, mode: HistoryMode) {
  const [, setParams] = useSearchParams();
  return useCallback(
    (next: string | null) => {
      setParams(
        (prev) => {
          const draft = new URLSearchParams(prev);
          if (next === null) draft.delete(key);
          else draft.set(key, next);
          return draft;
        },
        { replace: mode === 'replace' },
      );
    },
    [setParams, key, mode],
  );
}

/**
 * A search param constrained to a known set of values.
 *
 * An absent or unrecognised value falls back, so a stale or hand-edited URL
 * degrades to a working screen instead of an error. Writing the fallback drops
 * the param, keeping shared links short.
 */
export function useUrlEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
  mode: HistoryMode = 'replace',
): [T, (next: T) => void] {
  const [params] = useSearchParams();
  const write = useParamWriter(key, mode);

  const raw = params.get(key);
  const value = allowed.includes(raw as T) ? (raw as T) : fallback;

  const set = useCallback(
    (next: T) => write(next === fallback ? null : next),
    [write, fallback],
  );

  return [value, set];
}

/**
 * A search param holding an arbitrary string key, such as a record slug.
 *
 * `null` means "nothing selected" and is represented by the param's absence.
 */
export function useUrlKey(
  key: string,
  mode: HistoryMode = 'push',
): [string | null, (next: string | null) => void] {
  const [params] = useSearchParams();
  const write = useParamWriter(key, mode);
  return [params.get(key), write];
}

/** A search param holding a positive integer id, falling back when unparseable. */
export function useUrlId(
  key: string,
  fallback: number,
  mode: HistoryMode = 'push',
): [number, (next: number) => void] {
  const [params] = useSearchParams();
  const write = useParamWriter(key, mode);

  const parsed = Number(params.get(key));
  const value = Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;

  const set = useCallback(
    (next: number) => write(next === fallback ? null : String(next)),
    [write, fallback],
  );

  return [value, set];
}
