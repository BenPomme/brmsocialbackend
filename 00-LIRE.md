# Babyrock — dossier de construction

Produit vendu : **BabyRock Social** (réponses aux avis Google). **BabyRock Direct** (WhatsApp du commerce) = coming soon, pas vendu.
Villes et types de commerces : réglages admin, pas du code. Seed démo seulement.
Produit v2 : WhatsApp (FAQ + créneaux Calendar), après que v1 tourne.

Fondateur : Benjamin Pommeraud. Temps fondateur = monter l’usine, pas la faire tourner.
Opérateurs payés : Philippines uniquement.
Domaine : babyrock.ai (boîtes mail + comptes Google gestionnaire).

**Deux dépôts, ne pas les mélanger — ils devront se parler.**

| Dépôt | Rôle |
|---|---|
| [BenPomme/brmsocial](https://github.com/BenPomme/brmsocial) | Site public marketing `www.babyrock.ai` (Pages). Un autre agent. |
| [BenPomme/brmsocialbackend](https://github.com/BenPomme/brmsocialbackend) | Usine : admin, opérateur, inbox, agents, APIs, webhook WhatsApp. |

Ce dossier local = l’usine. `origin` = [brmsocialbackend](https://github.com/BenPomme/brmsocialbackend). Le site est le remote `website` → [brmsocial](https://github.com/BenPomme/brmsocial). Pas de landing marketing à coder ici.

Lien entre les deux, à brancher :
- WhatsApp du site (`wa.me` vers le numéro Babyrock **de prod**, pas le 555 test) → Meta → webhook usine `/api/webhooks/whatsapp`.
- S’abonner : le site pointe vers `/pay` sur l’usine (Checkout Stripe one-off). L’usine marque `clients.status = paye`. Le site n’encaisse pas.

## Fichiers

| Fichier | Contenu |
|---|---|
| `00-LIRE.md` | Index, outil de code, ce que la prochaine session doit faire |
| `CONTEXT.md` | Glossaire : Titulaire, Social, Direct, Fil Babyrock, Fil commerce |
| `01-produit.md` | Offre, prix, ce qu’on ne vend pas |
| `18-roadmap-produit.md` | Ordre Social → Direct, pas de dates |
| `02-marche-legal.md` | Cible villes, LSSI, RGPD |
| `03-parcours-client.md` | Du premier mail au jour normal, qui fait quoi |
| `04-ops-operateur.md` | Écran VA, checklist, rôles |
| `05-donnees.md` | Schéma Postgres, ce qu’on ne stocke pas |
| `06-architecture.md` | Processus, files, navigateurs isolés |
| `07-modeles-couts.md` | Quel modèle pour quelle tâche, plafonds |
| `08-demarchage.md` | Scout / mail / un WhatsApp |
| `09-publication-google.md` | Invitation gestionnaire, bouton Publier |
| `10-whatsapp-service.md` | Fil Babyrock (Social). Direct n’est pas dans ce fichier |
| `11-ordre-de-build.md` | Semaines 1–8, critères de passage |
| `12-decisions-ouvertes.md` | Points à figer avant de coder plus loin |
| `13-interfaces.md` | Opérateur / admin / client + agent Scope |
| `14-agents.md` | Liste d’agents v1, figée |
| `15-prototype.md` | Proto 3 interfaces (s’il est dans ce clone) |
| `16-plan-affaires.md` | Plan d’affaires |
| `17-seo-site-brm.md` | SEO / indexation de www.babyrock.ai |
| `docs/agents/catalog.md` | Ajouter un SKU / changer un prix / offre : un module, tous les touchpoints |

## Deadline : vendredi 4 sept. 2026 — démo au partenaire

Écran partagé, ~20 min. Le partenaire doit voir : on trouve un resto, on encaisse, **il reçoit une factura** (NIF/CIF, pour déduire l’IVA), on répond à un avis. Aucun mail/WA vers un resto réel. Publier = dry-run sauf fiche à nous.

Script visé : site (ou `/pay`) → fiche + **données fiscales** → Checkout 4242 → PDF facture → statut `paye` → admin scope/scout → file opérateur 5★ dry-run + 2★ OK titulaire. Lien de paiement aussi envoyable par WhatsApp (allowlist toi + partenaire).

## Fait (mardi 1er sept.) — Stripe sandbox

Checkout `/pay`, clés test, factura NIF. Catalogue **TTC** : **99 €/mes** suscripción, **990 €/an** suscripción. Sant Cugat : 1er mois 0 € (trial) + rattrapage 3 mois.

## Demain (mercredi 2 sept.) — même volume que mardi

Bloc principal = facture B2B. Un resto doit pouvoir **mettre la factura sur la société et récupérer la TVA**. Aujourd’hui `/pay` ne collecte que nom + e-mail : insuffisant.

1. **Identité fiscale sur `/pay` et `clients`** (voir `05-donnees.md`) : razón social, NIF/CIF ou n° TVA UE, adresse fiscale (ligne, CP, ville, pays), e-mail de facturation. Pays ES → IVA 21 % sur 99 TTC (81,82 HT). Ne pas allumer Stripe Tax (0,5 %) demain.
2. **Facture Stripe PDF** : Customer + `tax_id` + adresse, `invoice_creation` sur le Checkout **one-off** (toujours pas Billing). Après 4242, le PDF a le nom légal et le NIF. Admin : voir / renvoyer la facture.
3. **Lien de paiement par WhatsApp** : Rosalia envoie l’URL Checkout (ou `/pay` prérempli) via Cloud API, **allowlist seulement** (toi + partenaire si son n° est dans Meta To). Pas un resto. Réutiliser `whatsapp-send.ts`.
4. **Script démo écrit** (ordre des clics, comptes proto, ce qu’on ne montre pas : KYC, 555, Billing).
5. **File opérateur + client** : un 5★ dry-run et un 2★ → OK → `pret`, sans surprise au clic.
6. Si le temps reste : Inspect DataForSEO Sant Cugat affichable ; lot Rosalia composé à l’écran (pas d’envoi resto) ; copy `content/outreach/rosalia.es.txt`.

**Pas demain :** Billing 0,7 %, WABA prod (`#2593030`), numéro 555 sur www, publier sur une fiche Maps qui n’est pas à nous, Verifactu / facture électronique ES (comptable, après la démo).

Jeudi 3 : répétition chrono du script, coller site → `/pay` (agent `brmsocial` si pas fait), GBP sur 1 fiche à toi si possible, file d’incidents. Vendredi 4 : démo.

**Après vendredi — Rosalia qui apprend** (plan dans `10-whatsapp-service.md`) : tracer chaque tour (`rosalia_turns`), scripts en base par langue, écran d’occurrence, lien `/pay` dès OK, Head of Data propose, toi tu valides. Pas un nouvel agent. Pas de LLM pour « apprendre ».

**Backlog — CRM (important).** Une **fiche unique** par prospect / client : identité, contacts, fiscal, Google, statut. Plus **l’historique des interactions séparé par canal** (mail Zoho ≠ WhatsApp ≠ plus tard SMS). On ne fusionne pas un texto dans un e-mail. Écran admin : ouvrir la fiche, voir la timeline par canal. Détail : `05-donnees.md`. Sans ça on n’optimise pas Rosalia et on ne briefe pas l’opérateur.

## Comment reprendre ce dossier

Une autre session Grok (ou un humain) lit `00` puis `11`, ensuite le fichier de la brique qu’elle code.
Ne pas ré-ouvrir le débat produit. Les décisions déjà prises sont dans `12` (section « figées »).
Ne pas mettre de mots de passe Google dans l’app.
Ne pas publier un avis 1★–3★ sans OK du titulaire.
Ne pas utiliser une VM partagée pour les sessions Google des clients.
Ne pas ajouter d’agent hors `14-agents.md`.
Scope villes/catégories : console admin + agent Scope, jamais hardcodé.
SEO du site public : `17-seo-site-brm.md`, dans `site/build.mjs`, pas dans les workers avis.
