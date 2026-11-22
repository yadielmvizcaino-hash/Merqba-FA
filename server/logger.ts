export interface OperationLogEntry {
  ts: string;
  endpoint: string;
  opType: string;
  vendorId: number | null;
  durationMs: number;
  externalRequests: number;
  externalDurationMs: number;
  productsCount: number;
  httpStatus: number;
  cacheStatus?: 'hit' | 'stale' | 'miss' | 'bypass' | 'n/a';
  retries?: number;
  error?: string;
}

const MAX_RECENT_LOGS = 200;
const recentLogs: OperationLogEntry[] = [];

// Redact sensitive parameters (consumer_key, consumer_secret, tokens, passwords, cookies) from any string
export function sanitizeLogMessage(input: string): string {
  if (!input) return '';
  return input
    .replace(/(consumer_key|consumer_secret|password|token|nonce|cookie|authorization)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/(wordpress_logged_in[^=\s]*|wp_woocommerce_session[^=\s]*)=([^;\s]+)/gi, '$1=[REDACTED]')
    .replace(/\b(Cookie|Authorization)\s*:\s*[^\r\n]+/gi, '$1: [REDACTED]')
    .replace(/ck_[a-zA-Z0-9]{10,}/g, 'ck_[REDACTED]')
    .replace(/cs_[a-zA-Z0-9]{10,}/g, 'cs_[REDACTED]');
}

export function recordOperationMetric(entry: Omit<OperationLogEntry, 'ts'>): void {
  const cleanEntry: OperationLogEntry = {
    ...entry,
    ts: new Date().toISOString(),
    error: entry.error ? sanitizeLogMessage(entry.error).slice(0, 240) : undefined,
  };

  recentLogs.unshift(cleanEntry);
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.length = MAX_RECENT_LOGS;
  }

  // Structured stdout logging without sensitive payloads
  console.log(JSON.stringify({ level: entry.error ? 'warn' : 'info', service: 'merqba-fa', ...cleanEntry }));
}

export function getDiagnosticsSummary(vendorId?: number | null) {
  const scopedLogs = vendorId
    ? recentLogs.filter((l) => l.vendorId === vendorId || l.vendorId === null)
    : recentLogs;

  const totalOps = scopedLogs.length;
  const errorOps = scopedLogs.filter((l) => l.httpStatus >= 400 || Boolean(l.error)).length;
  const totalDuration = scopedLogs.reduce((acc, l) => acc + l.durationMs, 0);
  const totalExternalReqs = scopedLogs.reduce((acc, l) => acc + l.externalRequests, 0);
  const totalExternalDuration = scopedLogs.reduce((acc, l) => acc + l.externalDurationMs, 0);

  const cacheHits = scopedLogs.filter((l) => l.cacheStatus === 'hit').length;
  const cacheStale = scopedLogs.filter((l) => l.cacheStatus === 'stale').length;
  const cacheMisses = scopedLogs.filter((l) => l.cacheStatus === 'miss').length;

  const byEndpoint: Record<string, { count: number; avgDurationMs: number; errors: number; externalReqs: number }> = {};
  for (const log of scopedLogs) {
    if (!byEndpoint[log.endpoint]) {
      byEndpoint[log.endpoint] = { count: 0, avgDurationMs: 0, errors: 0, externalReqs: 0 };
    }
    const stat = byEndpoint[log.endpoint];
    stat.count += 1;
    stat.avgDurationMs += log.durationMs;
    stat.externalReqs += log.externalRequests;
    if (log.httpStatus >= 400 || log.error) {
      stat.errors += 1;
    }
  }
  for (const k of Object.keys(byEndpoint)) {
    byEndpoint[k].avgDurationMs = Math.round(byEndpoint[k].avgDurationMs / byEndpoint[k].count);
  }

  return {
    totalRecentOperations: totalOps,
    errorCount: errorOps,
    avgDurationMs: totalOps > 0 ? Math.round(totalDuration / totalOps) : 0,
    totalExternalRequests: totalExternalReqs,
    avgExternalDurationMs: totalExternalReqs > 0 ? Math.round(totalExternalDuration / totalExternalReqs) : 0,
    cacheStats: {
      hits: cacheHits,
      staleHits: cacheStale,
      misses: cacheMisses,
      hitRatioPercent:
        cacheHits + cacheStale + cacheMisses > 0
          ? Math.round(((cacheHits + cacheStale) / (cacheHits + cacheStale + cacheMisses)) * 100)
          : 0,
    },
    byEndpoint,
    recentErrors: scopedLogs.filter((l) => l.error || l.httpStatus >= 400).slice(0, 15),
  };
}
