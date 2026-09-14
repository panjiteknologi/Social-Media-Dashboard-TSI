import { max } from 'drizzle-orm';
import type { Db } from './db/client';
import { workerHeartbeats } from './db/schema';
import type { Alerter } from './jobs/runner';

export const HEARTBEAT_INTERVAL_MS = 30_000;

export const WORKER_SILENCE_ALERT_MS = 5 * 60_000;

const CHECK_INTERVAL_MS = 60_000;

export interface HeartbeatVerdict {
  alerting: boolean;
  message: string | null;
}

/**
 * Decides whether the worker's silence starts or ends an alert. Only the
 * transitions produce a message, so one outage sends one alert, not one a minute.
 */
export function evaluateHeartbeat(
  lastSeenAt: Date | null,
  now: Date,
  wasAlerting: boolean,
  thresholdMs = WORKER_SILENCE_ALERT_MS,
): HeartbeatVerdict {
  // No heartbeat at all means no worker has been deployed yet, not that one died.
  if (!lastSeenAt) return { alerting: wasAlerting, message: null };

  const silentMs = now.getTime() - lastSeenAt.getTime();
  const isSilent = silentMs > thresholdMs;

  if (isSilent && !wasAlerting) {
    const minutes = Math.round(silentMs / 60_000);
    return {
      alerting: true,
      message: `Worker has stopped checking in (last seen ${minutes} minutes ago). Scheduled jobs are not running.`,
    };
  }
  if (!isSilent && wasAlerting) {
    return { alerting: false, message: 'Worker is checking in again. Scheduled jobs have resumed.' };
  }
  return { alerting: wasAlerting, message: null };
}

/** Watches worker heartbeats from the API process, which stays up when the worker dies. */
export function startWorkerMonitor(db: Db, alerter: Alerter): () => void {
  let alerting = false;

  const check = async () => {
    try {
      const [row] = await db
        .select({ lastSeenAt: max(workerHeartbeats.lastSeenAt) })
        .from(workerHeartbeats);
      const verdict = evaluateHeartbeat(row?.lastSeenAt ?? null, new Date(), alerting);
      alerting = verdict.alerting;
      if (verdict.message) await alerter.send(verdict.message);
    } catch (error) {
      console.error('[monitor] Worker heartbeat check failed:', error);
    }
  };

  const timer = setInterval(check, CHECK_INTERVAL_MS);
  return () => clearInterval(timer);
}
