import webpush from "web-push";
import { PushSubscription } from "./models/PushSubscription";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const email = process.env.VAPID_EMAIL || "mailto:admin@zline.com";

if (publicKey && privateKey) {
  webpush.setVapidDetails(email, publicKey, privateKey);
} else {
  console.warn("VAPID keys not configured. Web push notifications will not be sent.");
}

export async function sendPushNotification(
  userIds: any[],
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
  }
) {
  if (!publicKey || !privateKey) return;

  try {
    const subscriptions = await PushSubscription.find({ userId: { $in: userIds } });
    const payloadStr = JSON.stringify(payload);

    const promises = subscriptions.map((sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      return webpush.sendNotification(pushConfig, payloadStr).catch((err) => {
        console.error(`Failed to send push to endpoint: ${sub.endpoint}`, err.statusCode);
        // Clean up expired/invalid subscriptions (410 Gone / 404 Not Found)
        if (err.statusCode === 410 || err.statusCode === 404) {
          return PushSubscription.deleteOne({ _id: sub._id });
        }
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("Error sending push notifications:", error);
  }
}
