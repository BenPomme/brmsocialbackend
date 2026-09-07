# Décisions

## Figées

- **Offre :** BabyRock Social **99 € TTC/mois** suscripción mensual ; **990 € TTC/an** suscripción anual. Factura HT+IVA 21 % ES. Sant Cugat : 1er mois 0 € (trial 30 j) puis 99 €/mes. Fil Babyrock (1–3★, topo) = Social, inclus. BabyRock Direct = pas vendu. France B2B n° TVA = HT seul. Checkout Stripe en `mode: subscription`.
- **Deux produits :** Social (`social`) vendu ; Direct (`direct`) coming soon. Pas le même WhatsApp. Pay n’accepte que les SKU Social.
- Humains PH seulement pour la prod
- Trois rôles : operator / admin / client (WhatsApp)
- Scope (villes, catégories, pays) : table + chat admin (agent `scope`). Pas en dur
- Agents v1 = table dans `14-agents.md` seulement
- 4–5★ : opérateur publie. 1–3★ : OK titulaire puis publie
- Invitation gestionnaire, jamais le mot de passe resto
- Bouton Publier, pas de copier-coller cible
- Mail + un WhatsApp si WA est sur le site. Pas de Maps-only. Pas de papier
- WhatsApp quotidien seulement s’il s’est passé quelque chose + lundi
- Mémoire client = Postgres. Pas Elephant
- Coder dans Grok Build. Bot ≠ runtime publication
- Marge ≥ 30 % avant salaire fondateur
- Fondateur hors file opérateur ; il a une console admin + agent Scope
- Paiement : Stripe Checkout **subscription** (cartes EEE + SEPA). 99 €/mes et 990 €/an se renouvellent seuls. Bizum si activé pour le 1er clic ES. Versement : IBAN Revolut de la SL. Site public → `/pay` usine.
- **Veille fiche (Social, inclus, avant lancement) :** bouclier fiche (heures / nom / téléphone / adresse / statut) ; avis disparu ; note + volume et delta ; proposition de modification Google en attente ; appels et demandes d’itinéraire **dans le récap lundi**. Jamais inventer une ligne : si l’API ne donne pas le chiffre, on omet. Festifs / special hours : ping Fil Babyrock, le titulaire répond CERRADO (on patche par API) **ou** il le change lui-même dans Google. Pas de patch heures par l’opérateur. **Pas** de competitor spy, **pas** de NAP, **pas** d’attributs, **pas** de Local Post.

## À figer (1 ligne chacune, avant semaine 5)

1. Engagement : mois par mois après le 1er mois, ou 3 mois fermes ?
2. ~~Résiliation : fin de période déjà payée, ou immédiat au BAJA ?~~ figé : fin de période déjà payée. Les réponses publiées restent. Le titulaire retire le gestionnaire.
3. Compte Google : un `reviews@` global ou un par vague de villes ?
4. Plafond rattrapage **hors** Sant Cugat : 20 avis, ou 30 jours glissants ? (Sant Cugat = 3 mois, locké)
5. Délai silence 1★ : 24 h puis abandon, ou 48 h + 1 relance ?
6. ~~Paiement : Stripe seul, Bizum seul, les deux ?~~ figé ci-dessus
7. Template Meta premier contact : on tente, ou mail-only jusqu’à juriste ?
8. Nom d’affichage WhatsApp et adresse gestionnaire exacte

## Hors scope volontaire

- iMessage / Linq
- Instinct
- Meerkat comme base de l’app
- Publication TripAdvisor / TheFork en v1
- Appels fondateur
- Publicité payante
