export function claimsNeedEvidence(text: string) {
  const t = text.toLowerCase();
  return {
    payment: /\b(pago confirmado|payment confirmed|ya consta el pago|we('ve| have) (received|got) (your )?payment|c'est payé chez nous)\b/i.test(
      t,
    ),
    published: /\b(publicado en google|published (it )?on google|we've published|c'est en ligne sur google)\b/i.test(t),
    googleLive: /\b(ya somos gestores|we are (live|connected) on google|gestionnaire (est )?connecté|google (ya )?acept[oó])\b/i.test(
      t,
    ),
  };
}

export function stripUngroundedClaims(
  text: string,
  evidence: { paid: boolean; published: boolean; googleConnected: boolean },
) {
  const c = claimsNeedEvidence(text);
  let out = text;
  if (c.payment && !evidence.paid) {
    out = "I don’t see a confirmed payment yet. Here is the pay link if you still need it.";
  }
  if (c.published && !evidence.published) {
    out = "Nothing has been published on Google from us yet. A person still has to press Publier.";
  }
  if (c.googleLive && !evidence.googleConnected) {
    out = "Google has not accepted the manager invite yet. I can’t say we are live on the listing.";
  }
  return out;
}
