# Babyrock — proto local

Un objectif : se connecter en admin, opérateur et client, avec de **vraies** fiches et avis Google, **sans** écrire à un commerce et **sans** publier sur une fiche qui n’est pas à nous.

Le site public est un **autre** repo : [github.com/BenPomme/brmsocial](https://github.com/BenPomme/brmsocial). Ici = proto usine seulement (pas de landing marketing).

Les villes et les catégories ne sont pas dans le code. Elles vivent dans `scope_cities` / `scope_categories`. Le chat admin propose un diff ; rien ne part en Scout tant que tu n’as pas cliqué **Appliquer**.

Les agents ici (scope, scout, draft, publish, et un fil client simulé) sont ceux qu’il faut pour cette marche. La liste dans `14-agents.md` n’est pas une constitution. On pourra en retirer ou en renommer quand on aura vu le proto tourner.

## Ce que le proto ne fait pas

- Pas de WhatsApp Meta, pas de SMS. `OUTBOUND_ENABLED=false` est forcé pour SMTP / WA / SMS. L’envoi mail de test passe par **Zoho Mail API (EU)**, From `rosalia@babyrock.ai`, **uniquement** vers `OUTREACH_ALLOWLIST` (toi). Pas un resto.
- Pas de scraping Maps. Uniquement **Places API (New)**.
- Publier écrit en base et loggue `dry-run, pas envoyé à Google`, sauf si un jour `publish_live=true` **et** on est gestionnaire GBP **et** l’écriture live est branchée (elle ne l’est pas encore).

## 1. Projet Google Cloud

1. Ouvre [Google Cloud Console](https://console.cloud.google.com/), crée un projet (le nom `babyrock-proto` va bien).
2. Active la facturation. Places est payant ; le quota gratuit est limité.
3. APIs et services → Activer des API → cherche **Places API (New)** (`places.googleapis.com`). C’est celle-là, pas l’ancienne « Places API ».
4. Geocoding est optionnel. Business Profile API n’est pas nécessaire pour ce proto (on lit les extraits Places, pas l’inbox gestionnaire).
5. Identifiants → Créer une clé API. Restreins-la :
   - API : Places API (New)
   - Application : pour du local, restriction IP ou « aucune » le temps du proto, puis referrers localhost. La clé reste **serveur** (fichier `.env`), jamais dans le navigateur.
6. Facturation → Budgets et alertes : un budget, par ex. **20 €**, alerte à 50 % / 90 % / 100 %. Places Details avec le champ `reviews` est du palier Enterprise + Atmosphere. Le proto plafonne le scout (10 fiches, 12 détails, 20 avis) pour ne pas te surprendre.

Places Details renvoie en général **cinq extraits d’avis**, pas l’historique. C’est suffisant pour marcher les trois rôles.

## 2. Lancer en local

Il te faut Node 20+ (22 va bien), Docker Desktop, et la clé Places dans `.env`.

```bash
cp .env.example .env
# Colle GOOGLE_PLACES_API_KEY=... dans .env
# XAI_API_KEY est optionnelle. Sans elle, le chat scope parse des phrases simples
# et les brouillons sont des templates.

docker compose up -d
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
# Si le 3000 est déjà pris (ici : Open WebUI), Next prendra 3001.
# Ou : npx next dev --turbopack -p 3001
```

Postgres écoute sur **localhost:5433** (pas 5432, pour ne pas te marcher sur un Postgres déjà là).

## Paiement Stripe (simu)

Clés **test** dans `.env`. Checkout **subscription** **99 € TTC / mes**, **990 € TTC / año** (factura HT + IVA 21 %). Sant Cugat : trial 30 j puis 99 €/mes. SKUs : `npm run stripe:skus`.

1. `npm run dev`
2. Admin → **Payer**, ou ouvre [http://localhost:3000/pay](http://localhost:3000/pay)
3. Carte `4242 4242 4242 4242`, date future, CVC 123
4. Retour `/pay/ok` : le client passe `paye`, ref Stripe stockée

Le site public (`brmsocial`) n’encaisse pas : son bouton S’abonner pointera vers cette `/pay`. Versement live = IBAN Revolut de la SL, dans le Dashboard Stripe, pas dans l’app.

Webhook (plus tard, pas bloquant pour la simu) : `STRIPE_WEBHOOK_SECRET` + `POST /api/webhooks/stripe`. En local le retour Checkout suffit.

Au démarrage, le serveur imprime une checklist :

- `GOOGLE_PLACES_API_KEY` — sans elle, login marche, Scout échoue clairement
- `XAI_API_KEY` — optionnelle
- `DATABASE_URL`
- `OUTBOUND_ENABLED=false` + refus des workers carrier / notify / wa_out / smtp / sms

Ouvre [http://localhost:3000](http://localhost:3000) (ou [http://localhost:3001](http://localhost:3001) si le 3000 est déjà pris).

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@babyrock.local` | `proto-admin` |
| Opérateur | `ops@babyrock.local` | `proto-ops` |
| Client | `client@babyrock.local` | `proto-client` |

## 3. Marche des trois rôles

Sans fiche Google à toi : le seed crée **Cala Demo**, un faux commerce (`publish_live=false`). Publier n’écrit jamais sur Maps.

1. **Opérateur** (`ops@babyrock.local`). File : 5★ Marta → 5 cases → Publier. La ligne passe `publie`, le log dit dry-run. 2★ Pau : pas de Publier tant que ce n’est pas `pret`.
2. **Client** (`client@babyrock.local`). Fil simulé (pas Meta). Ping 2★ → **OK** ou un texte. L’avis passe `pret`. Toujours dry-run.
3. **Admin** (optionnel, Places). « active Sant Cugat, catégorie restaurant ». **Appliquer**. Scout tire de vraies fiches Maps pour le démarchage, pas pour publier.

Si tu veux un brouillon modèle plutôt que le template : `XAI_API_KEY` dans `.env`, puis relancer le worker `draft` sur l’avis. Pas obligatoire pour la démo clics.

WhatsApp / SMS ne quittent pas la machine. Un mail Zoho de **test** peut partir de Rosalia vers l’allowlist seulement (`scripts/zoho-test-send.ts`). Pas de resto tant que la liste n’est pas élargie. Banner `OUTBOUND_ENABLED=false` pour SMTP / WA / SMS.

Si les cinq extraits Places d’un resto sont tous des 5★, le fil client n’aura pas de ping 1–3★. Élargis le scope (une autre ville, Relancer scout) ou ouvre plusieurs fiches : les extraits mixtes arrivent souvent.

## Comptes Google plus tard (pas bloquant)

`reviews@babyrock.ai` + 2FA chez toi, pas dans l’app. OAuth Business Profile seulement quand on voudra l’inbox complète **et** un Publier live sur **tes** fiches. Sans ça, on reste sur les extraits Places.

## 4. Zoho Mail (démarchage Rosalia)

Datacenter **EU**. OAuth Self Client, refresh token de l’utilisateur **`rosalia@babyrock.ai`**.

Variables : `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_MAIL_API=https://mail.zoho.eu`, `OUTREACH_FROM`, `OUTREACH_ALLOWLIST`.

Test déjà fait : Rosalia → `bpommeraud@babyrock.ai`, reçu. Relancer : `npx tsx scripts/zoho-test-send.ts`.

## xAI (brouillons, optionnel)

`XAI_API_KEY` vient de [console.x.ai](https://console.x.ai). C’est l’**API développeur**, facturée au token.

L’abo Grok / SuperGrok (chat, ce TUI, quota hebdo) **n’est pas** ce crédit. On ne peut pas « d’abord vider l’abo, puis basculer sur l’API ». Deux compteurs.

Sans clé : Scope parse des phrases simples, les brouillons d’avis sont des templates. Suffisant pour marcher les trois rôles.

Modèle par défaut `grok-4.3` (`XAI_MODEL` pour un autre slug).
