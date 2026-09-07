import { prisma } from "./db";
import { isPaidClient } from "./billing-state";
import { dataforseoLogin, dataforseoPassword } from "./env";
import { dfsLocationFor, postGoogleReviewsTasks, waitForGoogleReviewsTasks } from "./dataforseo";
import { placeDetails } from "./places";
import { detectLang } from "./language";
import { draftMany } from "./agents/draft";

const CATCHUP_MAX = 20;

export async function importCatchupReviews(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { skipped: true as const, reason: "no_client" };
  if (client.managerInviteStatus !== "accepted") return { skipped: true as const, reason: "no_manager" };
  if (!isPaidClient(client)) return { skipped: true as const, reason: "unpaid" };
  if (!client.placeId) return { skipped: true as const, reason: "no_place" };

  const existing = await prisma.avis.count({ where: { clientId } });
  if (existing >= CATCHUP_MAX) return { skipped: true as const, reason: "already_imported", imported: 0 };

  let imported = 0;
  const newIds: string[] = [];

  if (dataforseoLogin() && dataforseoPassword()) {
    try {
      const loc = dfsLocationFor(client.city ?? "", client.country ?? "ES");
      const posted = await postGoogleReviewsTasks([
        {
          place_id: client.placeId,
          language_code: loc.language_code,
          depth: CATCHUP_MAX,
          tag: client.id,
          location_code: loc.location_code,
          location_name: loc.location_name,
        },
      ]);
      const id = posted[0]?.id;
      if (id) {
        const waited = await waitForGoogleReviewsTasks([id], { timeoutMs: 90_000 });
        const got = waited.get(id);
        if (got?.ready && got.ok) {
          const unanswered = got.result.reviews.filter((r) => !r.ownerAnswer).slice(0, CATCHUP_MAX);
          for (const r of unanswered) {
            const exists = await prisma.avis.findUnique({ where: { googleReviewId: r.reviewId } });
            if (exists) continue;
            const created = await prisma.avis.create({
              data: {
                clientId,
                googleReviewId: r.reviewId,
                stars: r.stars,
                lang: detectLang(r.text, r.lang),
                authorPublicName: r.author,
                body: r.text,
                reviewedAt: r.reviewedAt,
                status: "nouveau",
              },
            });
            imported += 1;
            newIds.push(created.id);
          }
        }
      }
    } catch (e) {
      console.warn("catchup dataforseo", e);
    }
  }

  if (imported === 0) {
    try {
      const details = await placeDetails(client.placeId);
      for (const r of details.reviews.slice(0, CATCHUP_MAX)) {
        const exists = await prisma.avis.findUnique({ where: { googleReviewId: r.name } });
        if (exists) continue;
        const created = await prisma.avis.create({
          data: {
            clientId,
            googleReviewId: r.name,
            stars: r.rating,
            lang: detectLang(r.text, r.languageCode),
            authorPublicName: r.author,
            body: r.text,
            reviewedAt: r.publishTime ? new Date(r.publishTime) : null,
            status: "nouveau",
          },
        });
        imported += 1;
        newIds.push(created.id);
      }
    } catch (e) {
      console.warn("catchup places", e);
    }
  }

  const toDraft = [...new Set(newIds)].slice(0, CATCHUP_MAX);
  if (toDraft.length) {
    await draftMany(toDraft).catch((e) => console.warn("catchup draft", e));
  }
  return { skipped: false as const, imported: toDraft.length };
}
