# Produit

Deux produits. On n’en vend qu’un.

| Produit | Code | Statut |
|---|---|---|
| **BabyRock Social** | `social` | vendu maintenant |
| **BabyRock Direct** | `direct` | coming soon, pas de SKU, pas de `/pay` |
| **Pack** Social + Direct | `pack` | plus tard |
| **Direct setup** | `whatsapp_setup` | forfait une fois, plus tard |

WhatsApp **vers le titulaire** (brouillons 1–3★, topo, facture) fait partie de Social. Ce n’est pas Direct.

## BabyRock Social (vendu)

Abonnement : on répond aux avis Google du commerce.

Prix **TTC** (ce que le titulaire paie). Factura = HT + IVA 21 % ES.

- **99 € TTC / mois** (81,82 € HT + 17,18 € IVA) — suscripción mensual Stripe
- **990 € TTC / an** (818,18 € HT + 171,82 € IVA) — suscripción anual Stripe
- **Sant Cugat del Vallès** : 1er mois **0 €** (trial Stripe 30 jours), rattrapage 3 mois d’avis, puis 99 € TTC / mois en suscripción.
- Mise en service : **0 €** si le titulaire ajoute le gestionnaire Google lui-même

France B2B avec n° TVA : autoliquidation, le titulaire paie le HT (81,82 / 818,18).

Inclus :

- Import des avis sans réponse (plafond : 20 plus récents au onboarding, ensuite le flux)
- Brouillon dans la langue de l’avis (ES, CA, FR, EN)
- Publication 4★ et 5★ après clic opérateur (Publier ou Éditer puis Publier)
- 1★, 2★, 3★ : Fil Babyrock avec brouillon ; publication seulement après OK ou texte renvoyé
- WhatsApp au titulaire s’il s’est passé quelque chose dans la journée
- Récap lundi (réponses + note/volume + avis disparus + appels/itinéraire si Google les donne + propositions Google en attente)
- Bouclier fiche le jour même si heures, nom, téléphone, adresse ou statut changent
- Festifs : on prévient ; le titulaire dit CERRADO (API) ou il corrige la fiche lui-même. Pas l’opérateur.
- Journal de tout ce qui a été proposé / publié

Pas inclus dans Social : publicité, site, photos, TheFork, caisse, appel du fondateur, copier-coller VA, Fil commerce, demande d’avis après visite, liste de numéros, **promesse de plus d’avis**, competitor spy, NAP hors Google, attributs (terrasse, PMR…), Local Post / actualités Google.

Promesse : « On répond à vos avis Google. Les notes 4 et 5 partent après relecture. Les notes 1 à 3, vous validez le texte. Vous n’envoyez pas votre mot de passe. Vous ajoutez une adresse en gestionnaire. »

Comment obtenir plus d’avis (QR, etc.) : articles publics sur le site (roadmap §2), pas le produit.

## BabyRock Direct (pas vendu)

Autre produit. Le numéro WhatsApp du local, pour *ses* clients : réservation, rappel, demande d’avis après une visite connue. Pas le Fil Babyrock.

Pas d’écriture à froid. Pas de gating. Pas d’inbox Babyrock pour le service en salle. Pas de SKU tant que Social tient tout seul.

## Direct setup (pas vendu)

Mise en service une fois : numéro commerce et compte Meta, coexistence appli + API. Ce n’est pas un abonnement.

## Ce qui n’est aucun des deux

Instinct / iMessage comme canal principal.
Agent tout automatique sans humain.
Meerkat / Elephant comme base.
Un numéro Babyrock qui parle aux clients du commerce.
