import { SupabaseClient } from '@supabase/supabase-js';

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

// Send push notification to a user (via their stored subscriptions)
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  // Dynamically import web-push only when needed (server-side)
  let webpush: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    webpush = require('web-push');
  } catch {
    console.warn('web-push not installed. Skipping push notification.');
    return 0;
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@prospecta.easy';

  if (!vapidPublic || !vapidPrivate) {
    console.warn('VAPID keys not configured. Skipping push.');
    return 0;
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  // Fetch subscriptions for user
  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) return 0;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/icon-192x192.png',
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        pushPayload,
      );
      sent++;
    } catch (err: any) {
      // If subscription is expired/invalid, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id);
      }
      console.error('Push send error:', err.message);
    }
  }

  return sent;
}
