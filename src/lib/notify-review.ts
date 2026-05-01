import { loadUsers } from "@/lib/users";
import { sendReviewEmail } from "@/lib/email";
import { notify } from "@/lib/notify";

/** Fire when a platform's review count increases (new reviews) or rating drops.
 *  Notifies all portal users with their `review*` prefs enabled. */
export async function notifyReviewReceived(opts: {
  platformName: string;
  delta: number;
  newCount: number;
  oldCount: number;
  newRating: number;
  oldRating: number;
  origin: string;
}): Promise<void> {
  const { platformName, delta, newCount, newRating, oldRating, origin } = opts;
  if (delta <= 0) return;

  const ratingDropped = oldRating > 0 && newRating > 0 && newRating < oldRating - 0.05;
  const summary = ratingDropped
    ? `+${delta} new review${delta === 1 ? "" : "s"} · rating dropped to ${newRating.toFixed(1)}`
    : `+${delta} new review${delta === 1 ? "" : "s"}`;

  const users = await loadUsers();
  const url = `${origin}/reviews-social`;

  for (const u of users) {
    await notify({
      recipientEmail: u.email,
      actorEmail: "system@portal",
      kind: "review_received",
      payload: {
        itemKind: platformName,
        summary,
        newCount,
        newRating,
        ratingDropped,
      },
      inAppKey: "reviewInApp",
      emailKey: "reviewEmail",
      sendEmail: () => sendReviewEmail({
        to: u.email,
        recipientLabel: u.label,
        platformName,
        delta,
        newCount,
        newRating,
        oldRating,
        ratingDropped,
        url,
      }),
    });
  }
}
