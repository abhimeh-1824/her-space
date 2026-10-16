/**
 * HER-SPACE — Cloudflare Worker Cron Trigger
 * Automatically pings the protected Next.js internal endpoint
 * with the authorized Bearer token at designated curfew intervals.
 */

export interface Env {
  HOSTELGUARD_API_URL: string;
  CRON_SECRET: string;
}

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const cronTime = event.cron;
    const nowIso = new Date().toISOString();
    console.log(`[HER-SPACE Cron] Triggered for schedule '${cronTime}' at ${nowIso}`);

    // Determine curfew slot and job type based on cron expression
    let jobType = 'curfew_reminder_1';
    let slotKey = `cron_${nowIso.slice(0, 10)}_slot`;

    if (cronTime === '30 16 * * *') {
      jobType = 'curfew_window_open';
      slotKey = `cron_open_${nowIso.slice(0, 10)}`;
    } else if (cronTime === '45 16 * * *') {
      jobType = 'curfew_reminder_1';
      slotKey = `cron_rem1_${nowIso.slice(0, 10)}`;
    } else if (cronTime === '30 17 * * *') {
      jobType = 'curfew_reminder_2';
      slotKey = `cron_rem2_${nowIso.slice(0, 10)}`;
    } else if (cronTime === '30 18 * * *') {
      jobType = 'curfew_violation_alert';
      slotKey = `cron_cutoff_${nowIso.slice(0, 10)}`;
    }

    const payload = {
      slotKey,
      jobType,
      hostelId: 'HST-HER-01',
      sessionDate: nowIso.slice(0, 10),
    };

    const targetUrl = env.HOSTELGUARD_API_URL || 'https://her-space.vercel.app/api/scheduler/cron';
    const secret = env.CRON_SECRET || 'hostelguard_cf_worker_cron_sec_89b21';

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
          'X-Cron-Secret': secret,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(`[HER-SPACE Cron] Endpoint responded ${response.status}: ${responseText}`);
    } catch (err) {
      console.error('[HER-SPACE Cron] Error dispatching cron request:', err);
    }
  },

  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response(
      JSON.stringify({
        service: 'HER-SPACE Cloudflare Cron Worker',
        status: 'ONLINE',
        schedules: ['22:00 IST', '22:15 IST', '23:00 IST', '00:00 IST'],
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },
};
