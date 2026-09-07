import { quoteFor, type CatalogQuote } from "../catalog";
import type { ConvoLang, OnboardingStep } from "./types";

type Pack = Record<ConvoLang, string>;

const COPY: Record<string, Pack> = {
  pay: {
    es: `Aquí tiene el enlace de pago ({{PRICE_MONTH}}/mes):
{{PAYURL}}

{{OFFER}}Tarjeta o SEPA. En España el primer mes puede ser Bizum.`,
    ca: `Aquí té l’enllaç de pagament ({{PRICE_MONTH}}/mes):
{{PAYURL}}

{{OFFER}}Targeta o SEPA. A Espanya el primer mes pot ser Bizum.`,
    en: `Here is the payment link ({{PRICE_MONTH}}/month):
{{PAYURL}}

{{OFFER}}Card or SEPA. In Spain the first month can be Bizum.`,
    fr: `Voici le lien de paiement ({{PRICE_MONTH}}/mois) :
{{PAYURL}}

{{OFFER}}Carte ou SEPA. En Espagne le premier mois peut être Bizum.`,
  },
  pay_already: {
    es: "El enlace de pago está arriba.",
    ca: "L’enllaç de pagament és amunt.",
    en: "The payment link is in the message above.",
    fr: "Le lien de paiement est dans le message ci-dessus.",
  },
  ok: {
    es: `Perfecto{{NAME_COMMA}}. Para empezar:
1. Pago: {{PAYURL}}
{{OFFER}}2. Nos añade como gestor en Google ({{MANAGER}}), sin contraseña.

Cuando el pago esté confirmado, le guío el clic a clic del gestor.`,
    ca: `Perfecte{{NAME_COMMA}}. Per començar:
1. Pagament: {{PAYURL}}
{{OFFER}}2. Ens afegeix com a gestor a Google ({{MANAGER}}), sense contrasenya.

Quan el pagament estigui confirmat, el guiaré clic a clic.`,
    en: `Perfect{{NAME_COMMA}}. To start:
1. Pay: {{PAYURL}}
{{OFFER}}2. Add us as a Google manager ({{MANAGER}}), no password.

Once payment is confirmed, I’ll walk you through the manager clicks.`,
    fr: `Parfait{{NAME_COMMA}}. Pour commencer :
1. Paiement : {{PAYURL}}
{{OFFER}}2. Ajoutez-nous comme gestionnaire Google ({{MANAGER}}), sans mot de passe.

Après confirmation du paiement, je vous guide clic par clic.`,
  },
  stop: {
    es: `Entendido, no le vuelvo a escribir. Si cambia de idea, aquí estoy.

Gracias y que le vaya muy bien.
Rosalia — Babyrock Social`,
    ca: `Entesos, no li torno a escriure. Si canvia d’idea, sóc aquí.

Gràcies i que li vagi molt bé.
Rosalia — Babyrock Social`,
    en: `Understood — I won’t write again. If you change your mind, I’m here.

All the best.
Rosalia — Babyrock Social`,
    fr: `Compris, je ne vous réécris plus. Si vous changez d’avis, je suis là.

Bonne continuation.
Rosalia — Babyrock Social`,
  },
  hello: {
    es: `Hola{{NAME}}, soy Rosalia de Babyrock Social. Respondemos las reseñas de Google de su negocio por {{PRICE_MONTH}} al mes.

{{OFFER}}{{CITY_HINT}}Si le interesa, responda OK y le mando el enlace de pago.`,
    ca: `Hola{{NAME}}, sóc la Rosalia de Babyrock Social. Responem les ressenyes de Google del seu negoci per {{PRICE_MONTH}} al mes.

{{OFFER}}{{CITY_HINT}}Si li interessa, respongui OK i li envio l’enllaç de pagament.`,
    en: `Hi{{NAME}}, I’m Rosalia from Babyrock Social. We reply to your Google reviews for {{PRICE_MONTH}} a month.

{{OFFER}}{{CITY_HINT}}If that’s useful, reply OK and I’ll send the payment link.`,
    fr: `Bonjour{{NAME}}, je suis Rosalia de Babyrock Social. Nous répondons aux avis Google de votre commerce pour {{PRICE_MONTH}} par mois.

{{OFFER}}{{CITY_HINT}}Si cela vous intéresse, répondez OK et je vous envoie le lien de paiement.`,
  },
  hello_again: {
    es: "Hola de nuevo{{NAME}}. Si quiere, seguimos:\n{{PAY}}",
    ca: "Hola de nou{{NAME}}. Si vol, seguim:\n{{PAY}}",
    en: "Hi again{{NAME}}. If you want, we can continue:\n{{PAY}}",
    fr: "Rebonjour{{NAME}}. Si vous voulez, on continue :\n{{PAY}}",
  },
  interest: {
    es: `Hola{{NAME}}, perfecto. El servicio cuesta {{PRICE_MONTH}}/mes. Redactamos y publicamos las 4–5★. Las 1–3★ le llegan por WhatsApp para que diga OK o cambie el texto.

{{OFFER}}Le añadimos como gestor ({{MANAGER}}), sin contraseña.

{{PAY}}`,
    ca: `Hola{{NAME}}, perfecte. El servei val {{PRICE_MONTH}}/mes. Redactem i publiquem les 4–5★. Les 1–3★ li arriben per WhatsApp perquè digui OK o canviï el text.

{{OFFER}}L’afegim com a gestor ({{MANAGER}}), sense contrasenya.

{{PAY}}`,
    en: `Great{{NAME_COMMA}}. It’s {{PRICE_MONTH}}/month. We write and publish 4–5★ replies. 1–3★ come to you on WhatsApp so you can say OK or edit.

{{OFFER}}We add {{MANAGER}} as Google manager — no password.

{{PAY}}`,
    fr: `Parfait{{NAME_COMMA}}. C’est {{PRICE_MONTH}}/mois. Nous rédigeons et publions les 4–5★. Les 1–3★ vous arrivent sur WhatsApp pour un OK ou une modification.

{{OFFER}}Nous ajoutons {{MANAGER}} comme gestionnaire, sans mot de passe.

{{PAY}}`,
  },
  value: {
    es: `Sí: quien busca un comercio en Google mira las reseñas primero. Si el local no responde, parece abandonado. Por {{PRICE_MONTH}}/mes una persona de Babyrock responde todas, cada mes.

{{PAY}}`,
    ca: `Sí: qui busca un comerç a Google mira les ressenyes primer. Si el local no respon, sembla abandonat. Per {{PRICE_MONTH}}/mes una persona de Babyrock les respon totes, cada mes.

{{PAY}}`,
    en: `Yes: people looking for a shop on Google read the reviews first. If the place never replies, it looks abandoned. For {{PRICE_MONTH}}/month someone at Babyrock answers all of them, every month.

{{PAY}}`,
    fr: `Oui : qui cherche un commerce sur Google lit d’abord les avis. Si le local ne répond pas, il a l’air à l’abandon. Pour {{PRICE_MONTH}}/mois, quelqu’un chez Babyrock répond à tous, chaque mois.

{{PAY}}`,
  },
  price: {
    es: `{{PRICE_MONTH}} al mes, suscripción mensual (sin permanencia). Suscripción anual: {{PRICE_YEAR}}, se cobra cada año. 4–5★ las publicamos; 1–3★ usted dice OK o cambia el texto.

{{OFFER}}{{CITY_HINT}}{{PAY}}`,
    ca: `{{PRICE_MONTH}} al mes, subscripció mensual (sense permanència). Subscripció anual: {{PRICE_YEAR}}, es cobra cada any. 4–5★ les publiquem; 1–3★ vostè diu OK o canvia el text.

{{OFFER}}{{CITY_HINT}}{{PAY}}`,
    en: `{{PRICE_MONTH}} per month, monthly subscription (no lock-in). Yearly subscription: {{PRICE_YEAR}}, billed every year. We publish 4–5★; 1–3★ you say OK or edit the text.

{{OFFER}}{{CITY_HINT}}{{PAY}}`,
    fr: `{{PRICE_MONTH}} par mois, abonnement mensuel (sans engagement). Abonnement annuel : {{PRICE_YEAR}}, prélevé chaque année. 4–5★ : on publie ; 1–3★ : vous dites OK ou vous corrigez.

{{OFFER}}{{CITY_HINT}}{{PAY}}`,
  },
  manager: {
    es: `No pedimos su contraseña. En Google: añadir {{MANAGER}} como gestor (no como propietario). Le guío el clic a clic. El pago es el otro paso: {{PAY}}`,
    ca: `No demanem la contrasenya. A Google: afegir {{MANAGER}} com a gestor (no com a propietari). El guiaré clic a clic. El pagament és l’altre pas: {{PAY}}`,
    en: `We never ask for your password. In Google: add {{MANAGER}} as a manager (not owner). I’ll walk you through it. Payment is the other step: {{PAY}}`,
    fr: `Nous ne demandons pas votre mot de passe. Dans Google : ajouter {{MANAGER}} comme gestionnaire (pas propriétaire). Je vous guide clic par clic. Le paiement est l’autre étape : {{PAY}}`,
  },
  how: {
    es: `Usted nos da acceso de gestor a la ficha Google (sin contraseña). Nosotros redactamos; una persona publica. Usted no escribe cada día. 4–5★: publicamos. 1–3★: valida por WhatsApp.

Si quiere empezar: {{PAY}}`,
    ca: `Vostè ens dóna accés de gestor a la fitxa Google (sense contrasenya). Nosaltres redactem; una persona publica. Vostè no escriu cada dia. 4–5★: publiquem. 1–3★: valida per WhatsApp.

Si vol començar: {{PAY}}`,
    en: `You add us as a Google manager (no password). We draft; a person publishes. You don’t write every day. 4–5★: we publish. 1–3★: you approve on WhatsApp.

To start: {{PAY}}`,
    fr: `Vous nous donnez l’accès gestionnaire Google (sans mot de passe). Nous rédigeons ; une personne publie. Vous n’écrivez pas chaque jour. 4–5★ : on publie ; 1–3★ : vous validez sur WhatsApp.

Pour commencer : {{PAY}}`,
  },
  lang: {
    es: `Por supuesto, hablamos en castellano. Respondemos cada reseña de Google en su idioma (castellano, catalán, francés, inglés).`,
    ca: `Parlem en català. Responem cada ressenya de Google en el seu idioma (castellà, català, francès, anglès).`,
    en: `Yes — we can talk here in English. We also reply to each Google review in its own language (Spanish, Catalan, French, English).`,
    fr: `Oui, on peut parler français ici. Et chaque avis Google est répondu dans sa langue (castillan, catalan, français, anglais).`,
  },
  what: {
    es: `Babyrock Social (Sant Cugat). Ayudamos a comercios a responder sus reseñas de Google, todos los meses, sin que el dueño tenga que hacerlo.`,
    ca: `Babyrock Social (Sant Cugat). Ajudem comerços a respondre les ressenyes de Google, cada mes, sense que el propietari ho hagi de fer.`,
    en: `Babyrock Social (Sant Cugat). We help shops answer their Google reviews every month, so the owner doesn’t have to.`,
    fr: `Babyrock Social (Sant Cugat). Nous aidons les commerces à répondre à leurs avis Google chaque mois, sans que le patron s’en charge.`,
  },
  hours: {
    es: `Publicamos en horario razonable del negocio. Los 1–3★ le llegan por WhatsApp para que valide.`,
    ca: `Publiquem en horari raonable del negoci. Les 1–3★ li arriben per WhatsApp perquè validi.`,
    en: `We publish in the shop’s normal hours. 1–3★ come to you on WhatsApp for a yes.`,
    fr: `Nous publions aux heures raisonnables du commerce. Les 1–3★ vous arrivent sur WhatsApp à valider.`,
  },
  trial: {
    es: `No hay mes gratis salvo Sant Cugat del Vallès (primer mes 0 €). Si quiere, le enseño con una reseña de ejemplo cómo quedaría, sin publicar nada.`,
    ca: `No hi ha mes de prova fora de Sant Cugat del Vallès (primer mes 0 €). Si vol, li ensenyo amb una ressenya d’exemple com quedaria, sense publicar res.`,
    en: `There’s no free month except Sant Cugat del Vallès (first month 0 €). If you like, I can show a sample reply on one review, without publishing.`,
    fr: `Pas de mois gratuit hors Sant Cugat del Vallès (premier mois 0 €). Si vous voulez, je vous montre un exemple de réponse, sans rien publier.`,
  },
  thanks: {
    es: `A usted{{NAME}}. Cuando quiera, OK y seguimos.`,
    ca: `A vostè{{NAME}}. Quan vulgui, OK i seguim.`,
    en: `You’re welcome{{NAME}}. When you’re ready, OK and we continue.`,
    fr: `Avec plaisir{{NAME}}. Quand vous voulez, OK et on continue.`,
  },
  who_writes: {
    es: `Una persona de Babyrock redacta y publica. No es un bot que suelta texto solo en su ficha.

{{PAY}}`,
    ca: `Una persona de Babyrock redacta i publica. No és un bot que deixa text sol a la fitxa.

{{PAY}}`,
    en: `A person at Babyrock writes and publishes. It isn’t a bot posting alone on your listing.

{{PAY}}`,
    fr: `Une personne chez Babyrock rédige et publie. Ce n’est pas un bot qui poste tout seul.

{{PAY}}`,
  },
  cancel: {
    es: `Mes a mes, sin permanencia de 3 meses. Avisa y paramos al final del periodo ya pagado.

{{PAY}}`,
    ca: `Mes a mes, sense permanència de 3 mesos. Aviseu i parem al final del període ja pagat.

{{PAY}}`,
    en: `Month to month, no 3-month lock-in. Tell us and we stop at the end of the period already paid.

{{PAY}}`,
    fr: `Mois par mois, sans engagement de 3 mois. Vous dites stop, on arrête à la fin de la période déjà payée.

{{PAY}}`,
  },
  past_reviews: {
    es: `Sí: al darnos el gestor, respondemos también las reseñas antiguas sin respuesta (en la práctica, los últimos meses), no solo las nuevas.

{{PAY}}`,
    ca: `Sí: en donar-nos el gestor, també responem les ressenyes antigues sense resposta, no només les noves.

{{PAY}}`,
    en: `Yes. Once you add us as manager, we also reply to older unanswered reviews (typically the last months), not only new ones.

{{PAY}}`,
    fr: `Oui. Une fois gestionnaire, nous répondons aussi aux anciens avis sans réponse (en pratique les derniers mois), pas seulement aux nouveaux.

{{PAY}}`,
  },
  after_pay: {
    es: `El mismo día: le guío el clic a clic del gestor Google. En cuanto Google acepte la invitación, respondemos.

{{PAY}}`,
    ca: `El mateix dia: el guiaré clic a clic del gestor Google. Així que Google accepti la invitació, responem.

{{PAY}}`,
    en: `Same day: I walk you through adding the Google manager. As soon as Google accepts the invite, we start replying.

{{PAY}}`,
    fr: `Le jour même : je vous guide pour le gestionnaire Google. Dès que Google accepte l’invitation, on répond.

{{PAY}}`,
  },
  fallback: {
    es: "He recibido su mensaje. Se lo paso a un compañero y le respondo enseguida. — Rosalia",
    ca: "He rebut el seu missatge. Ho passo a un company i li responc de seguida. — Rosalia",
    en: "Got it. I’ll pass this to a colleague and come back to you shortly. — Rosalia",
    fr: "Bien reçu. Je transmets à un collègue et je vous réponds tout de suite. — Rosalia",
  },
  repeat: {
    es: "Se lo acabo de contar. El enlace de pago está arriba. ¿Otra duda, o pagamos?",
    ca: "Ja li ho he explicat. L’enllaç és amunt. Un altre dubte, o paguem?",
    en: "I just covered that. The payment link is above. Another question, or shall we pay?",
    fr: "Je viens de l’expliquer. Le lien est au-dessus. Une autre question, ou on paie ?",
  },
  nudge: {
    es: "Dígame: precio, cómo funciona, o OK y le mando el enlace.",
    ca: "Digui’m: preu, com funciona, o OK i li envio l’enllaç.",
    en: "Ask me about price, how it works, past reviews, or say OK and I’ll send the payment link.",
    fr: "Demandez-moi le prix, comment ça marche, les anciens avis, ou dites OK pour le lien de paiement.",
  },
  paid_unconfirmed: {
    es: "Gracias. Estoy esperando la confirmación de contabilidad; debería ser rápido. Le escribo en cuanto llegue.",
    ca: "Gràcies. Estic esperant la confirmació de comptabilitat; hauria de ser ràpid. Li escric així que arribi.",
    en: "Thanks — I’m waiting for confirmation from accounting. This should be quick. I’ll get back to you.",
    fr: "Merci. J’attends la confirmation de la comptabilité ; ce devrait être rapide. Je vous écris dès que c’est là.",
  },
  payment_confirmed: {
    es: "Contabilidad confirma el pago. Siguiente paso: el gestor de Google, sin contraseña.",
    ca: "Comptabilitat confirma el pagament. Següent pas: el gestor de Google, sense contrasenya.",
    en: "Accounting confirms the payment. Next: Google manager access, no password.",
    fr: "La comptabilité confirme le paiement. Suite : le gestionnaire Google, sans mot de passe.",
  },
  trial_started: {
    es: "Primer mes 0 € en Sant Cugat, confirmado. Siguiente paso: el gestor de Google, sin contraseña.",
    ca: "Primer mes 0 € a Sant Cugat, confirmat. Següent pas: el gestor de Google, sense contrasenya.",
    en: "First month 0 € in Sant Cugat, confirmed. Next: Google manager access, no password.",
    fr: "Premier mois 0 € à Sant Cugat, confirmé. Suite : le gestionnaire Google, sans mot de passe.",
  },
  media_unsupported: {
    es: "Todavía no puedo ver fotos ni escuchar notas de voz. Escríbame en texto, por favor.",
    ca: "Encara no puc veure fotos ni escoltar notes de veu. Escriviu-me en text, si us plau.",
    en: "I can’t see photos or listen to voice notes yet. Please write in text.",
    fr: "Je ne peux pas encore voir les photos ni écouter les notes vocales. Écrivez-moi en texte, s’il vous plaît.",
  },
  onboard_maps: {
    es: `Paso 1: abra Google Maps, busque su negocio y entre en la ficha. ¿Ve «Perfil de empresa» o el lápiz? Responda SÍ cuando lo tenga.`,
    ca: `Pas 1: obriu Google Maps, busqueu el negoci i entreu a la fitxa. Veieu «Perfil d’empresa» o el llapis? Digueu SÍ quan el tingueu.`,
    en: `Step 1: open Google Maps, find your shop, open the listing. Do you see “Business profile” or the pencil? Reply YES when you have it.`,
    fr: `Étape 1 : ouvrez Google Maps, cherchez votre commerce, ouvrez la fiche. Voyez-vous « Profil d’entreprise » ou le crayon ? Répondez OUI quand c’est là.`,
  },
  onboard_people: {
    es: `Paso 2: en el perfil, abra Personas y acceso (a veces «Managers» o «Usuarios»). Responda SÍ cuando lo vea.`,
    ca: `Pas 2: al perfil, obriu Persones i accés (de vegades «Managers»). Digueu SÍ quan ho veieu.`,
    en: `Step 2: in the profile, open People and access (sometimes “Managers”). Reply YES when you see it.`,
    fr: `Étape 2 : dans le profil, ouvrez Personnes et accès (parfois « Managers »). Répondez OUI quand vous le voyez.`,
  },
  onboard_email: {
    es: `Paso 3: invite a {{MANAGER}} (copie el correo tal cual). No es su contraseña. Responda SÍ cuando lo haya pegado.`,
    ca: `Pas 3: inviteu {{MANAGER}} (copieu el correu tal qual). No és la contrasenya. Digueu SÍ quan l’hàgiu enganxat.`,
    en: `Step 3: invite {{MANAGER}} (paste the email exactly). Not your password. Reply YES when it’s pasted.`,
    fr: `Étape 3 : invitez {{MANAGER}} (collez l’e-mail tel quel). Ce n’est pas votre mot de passe. Répondez OUI une fois collé.`,
  },
  onboard_role: {
    es: `Paso 4: elija el rol Gestor / Manager, no Propietario. Envíe la invitación. Responda SÍ cuando salga «enviada».`,
    ca: `Pas 4: trieu el rol Gestor / Manager, no Propietari. Envieu la invitació. Digueu SÍ quan surti «enviada».`,
    en: `Step 4: choose Manager, not Owner. Send the invite. Reply YES when it says sent.`,
    fr: `Étape 4 : choisissez Gestionnaire / Manager, pas Propriétaire. Envoyez l’invitation. Répondez OUI quand c’est envoyé.`,
  },
  onboard_wait: {
    es: `Recibido. Cuando Google acepte la invitación a {{MANAGER}}, le confirmo. Si ha puesto Propietario en vez de Gestor, cámbielo.`,
    ca: `Rebut. Quan Google accepti la invitació a {{MANAGER}}, li confirmo. Si ha posat Propietari en lloc de Gestor, canvieu-ho.`,
    en: `Got it. I’ll confirm when Google accepts the invite to {{MANAGER}}. If you picked Owner instead of Manager, change it.`,
    fr: `Bien reçu. Je confirme quand Google accepte l’invitation à {{MANAGER}}. Si vous avez mis Propriétaire au lieu de Gestionnaire, changez-le.`,
  },
  onboard_premature: {
    es: `Todavía no nos llega la invitación en Google. Compruebe: correo {{MANAGER}}, rol Gestor (no propietario), y que está con la cuenta que es titular de la ficha.`,
    ca: `Encara no ens arriba la invitació a Google. Comproveu: correu {{MANAGER}}, rol Gestor (no propietari), i que sou amb el compte titular de la fitxa.`,
    en: `We don’t have the Google invite yet. Check: email {{MANAGER}}, role Manager (not owner), and you’re on the account that owns the listing.`,
    fr: `L’invitation Google ne nous est pas encore arrivée. Vérifiez : e-mail {{MANAGER}}, rôle Gestionnaire (pas propriétaire), et le compte titulaire de la fiche.`,
  },
  in_business: {
    es: `Hemos recibido y aceptado la invitación a {{MANAGER}}. Gracias: empezamos a trabajar en su cuenta ahora. Las 4–5★ las publicamos; las 1–3★ le llegan aquí para un OK.`,
    ca: `Hem rebut i acceptat la invitació a {{MANAGER}}. Gràcies: comencem a treballar en el compte ara. Les 4–5★ les publiquem; les 1–3★ li arriben aquí per un OK.`,
    en: `We’ve received and accepted the invite to {{MANAGER}}. Thanks — we’ll start working on your account now. We publish 4–5★; 1–3★ come here for your OK.`,
    fr: `Nous avons reçu et accepté l’invitation à {{MANAGER}}. Merci : nous commençons à travailler sur votre compte maintenant. 4–5★ on publie ; 1–3★ vous arrivent ici pour un OK.`,
  },
  manager_accepted_unpaid: {
    es: `Hemos recibido y aceptado la invitación a {{MANAGER}} como gestor. Empezamos a trabajar cuando el pago (o el mes gratis de la suscripción) esté hecho.

{{PAY}}`,
    ca: `Hem rebut i acceptat la invitació a {{MANAGER}} com a gestor. Comencem a treballar quan el pagament (o el mes de franc de la subscripció) estigui fet.

{{PAY}}`,
    en: `We’ve received and accepted the {{MANAGER}} manager invite. We’ll start working once payment is done (or the free month of the subscription has started).

{{PAY}}`,
    fr: `Nous avons reçu et accepté l’invitation gestionnaire {{MANAGER}}. Nous commençons dès que le paiement est fait (ou le mois offert de l’abonnement a commencé).

{{PAY}}`,
  },
  manager_owner_wrong: {
    es: `La invitación a {{MANAGER}} llegó como Propietario, no como Gestor. La hemos rechazado: es un error. Vuelva a invitarnos como Gestor / Manager (no propietario).`,
    ca: `La invitació a {{MANAGER}} ha arribat com a Propietari, no com a Gestor. L’hem rebutjada: és un error. Torneu a convidar-nos com a Gestor / Manager (no propietari).`,
    en: `The invite to {{MANAGER}} came as Owner, not Manager. We declined it — that’s a mistake. Please invite us again as Manager (not owner).`,
    fr: `L’invitation à {{MANAGER}} est arrivée en Propriétaire, pas Gestionnaire. Nous l’avons refusée : c’est une erreur. Réinvitez-nous comme Gestionnaire / Manager (pas propriétaire).`,
  },
  ask_maps: {
    es: `¿Le importaría compartirme el enlace de Google Maps de su establecimiento, o el nombre y la dirección?`,
    ca: `Li faria res compartir-me l’enllaç de Google Maps del seu establiment, o el nom i l’adreça?`,
    en: `Would you mind sharing the Google Maps link of your establishment, or its name and address?`,
    fr: `Pourriez-vous me partager le lien Google Maps de votre établissement, ou son nom et son adresse ?`,
  },
  off_catalog: {
    es: `Eso no lo vendemos ahora. BabyRock Social = responder reseñas de Google, {{PRICE_MONTH}}/mes. BabyRock Direct (WhatsApp de sus clientes) viene más adelante. Instagram, SEO o anuncios, no.

{{PAY}}`,
    ca: `Això no ho venem ara. BabyRock Social = respondre ressenyes de Google, {{PRICE_MONTH}}/mes. BabyRock Direct (WhatsApp dels seus clients) vindrà més endavant. Instagram, SEO o anuncis, no.

{{PAY}}`,
    en: `We don’t sell that yet. BabyRock Social = Google review replies, {{PRICE_MONTH}}/month. BabyRock Direct (WhatsApp for your customers) is coming later. No Instagram, SEO, or ads.

{{PAY}}`,
    fr: `On ne vend pas ça pour l’instant. BabyRock Social = réponses aux avis Google, {{PRICE_MONTH}}/mois. BabyRock Direct (WhatsApp de vos clients) viendra plus tard. Pas d’Instagram, SEO ni pubs.

{{PAY}}`,
  },
  low_star_ok: {
    es: "OK recibido. Una persona publicará este texto en Google.",
    ca: "OK rebut. Una persona publicarà aquest text a Google.",
    en: "OK received. A person will publish this text on Google.",
    fr: "OK reçu. Une personne publiera ce texte sur Google.",
  },
  low_star_text: {
    es: "Texto recibido. Es el que publicaremos si la persona de Babyrock pulsa Publier.",
    ca: "Text rebut. És el que publicarem si la persona de Babyrock prem Publicar.",
    en: "Got your wording. That’s what we’ll publish when someone at Babyrock hits Publish.",
    fr: "Texte reçu. C’est celui qui partira quand quelqu’un chez Babyrock cliquera Publier.",
  },
  cerrado: {
    es: "CERRADO recibido. Lo aplicaremos en Google cuando la API de escritura esté activa. Mientras tanto, cámbielo usted en su perfil de empresa. Nosotros no tocamos el horario a mano.",
    ca: "CERRADO rebut. L’aplicarem a Google quan l’API d’escriptura estigui activa. Mentrestant, canvieu-ho vós al perfil d’empresa. Nosaltres no toquem l’horari a mà.",
    en: "CERRADO received. We’ll patch Google when write access is live. Until then, change it yourself in the business profile. We don’t edit hours by hand.",
    fr: "CERRADO reçu. Nous l’appliquerons sur Google quand l’API d’écriture sera là. En attendant, changez-le dans le profil. Nous ne touchons pas les horaires à la main.",
  },
  baja_active: {
    es: "De acuerdo. Paramos al final del periodo ya pagado. Las respuestas publicadas se quedan. Recuerde retirar a {{MANAGER}} como gestor cuando quiera.",
    ca: "D’acord. Parem al final del període ja pagat. Les respostes publicades es queden. Recordeu retirar {{MANAGER}} com a gestor quan vulgueu.",
    en: "Understood. We stop at the end of the period already paid. Published replies stay. Remember to remove {{MANAGER}} as manager when you want.",
    fr: "D’accord. On s’arrête à la fin de la période déjà payée. Les réponses publiées restent. Pensez à retirer {{MANAGER}} comme gestionnaire.",
  },
  invoice: {
    es: "La factura sale en el correo de facturación (PDF de Stripe, NIF y razón social). Si no le llega, dígame el correo y la reenviamos.",
    ca: "La factura surt al correu de facturació (PDF de Stripe, NIF i raó social). Si no li arriba, digui’m el correu i la reenviem.",
    en: "The invoice goes to the billing email (Stripe PDF, tax id and legal name). If it didn’t arrive, send me the email and we’ll resend.",
    fr: "La facture part sur l’e-mail de facturation (PDF Stripe, n° TVA et raison sociale). Si vous ne l’avez pas, donnez-moi l’e-mail, on renvoie.",
  },
  invoice_link: {
    es: "Aquí tiene la factura:\n{{INVOICE}}\nSi necesita otra cosa, dígamelo.",
    ca: "Aquí té la factura:\n{{INVOICE}}\nSi necessita res més, digui-m’ho.",
    en: "Here is the invoice:\n{{INVOICE}}\nAnything else, tell me.",
    fr: "Voici la facture :\n{{INVOICE}}\nSi besoin, dites-moi.",
  },
  edit_published: {
    es: "De acuerdo: una persona edita esa respuesta ya publicada. No lo hacemos en automático. Lo dejo al equipo.",
    ca: "D’acord: una persona edita aquesta resposta ja publicada. No ho fem automàtic. Ho deixo a l’equip.",
    en: "Understood: a person will edit that already-published reply. We don’t do that automatically. I’ll pass it to the team.",
    fr: "D’accord : une personne modifiera cette réponse déjà en ligne. Pas d’auto. Je passe au collègue.",
  },
};

const ONBOARD_IDS: Record<Exclude<OnboardingStep, "done">, string> = {
  maps: "onboard_maps",
  people: "onboard_people",
  email: "onboard_email",
  role: "onboard_role",
  wait_google: "onboard_wait",
};

export function onboardCopyId(step: OnboardingStep) {
  if (step === "done") return "in_business";
  return ONBOARD_IDS[step];
}

export const SCRIPT_IDS = Object.keys(COPY);

export function hasScript(id: string) {
  return Boolean(COPY[id]);
}

function withName(s: string, name?: string | null) {
  const n = (name ?? "").trim();
  return s.replace(/\{\{NAME_COMMA\}\}/g, n ? `, ${n}` : "").replace(/\{\{NAME\}\}/g, n ? ` ${n}` : "");
}

export function rawCopy(id: string, lang: ConvoLang, name?: string | null) {
  return withName(COPY[id]?.[lang] ?? COPY[id]?.es ?? "", name);
}

export function fillTemplate(
  body: string,
  opts: {
    lang: ConvoLang;
    name?: string | null;
    quote: CatalogQuote;
    payUrl: string;
    alreadySentPay: boolean;
    invoiceUrl?: string | null;
  },
) {
  const offer = opts.quote.offer ? `${opts.quote.offerLines[opts.lang]}\n` : "";
  const hint = opts.quote.offer ? "" : `${opts.quote.cityHintLines[opts.lang]}\n`;
  const payRaw = opts.alreadySentPay ? rawCopy("pay_already", opts.lang, opts.name) : rawCopy("pay", opts.lang, opts.name);
  const merged = withName(body.replace(/\{\{PAY\}\}/g, payRaw), opts.name);
  return merged
    .replace(/\{\{PRICE_MONTH\}\}/g, opts.quote.monthLabel)
    .replace(/\{\{PRICE_YEAR\}\}/g, opts.quote.yearLabel)
    .replace(/\{\{MANAGER\}\}/g, opts.quote.managerEmail)
    .replace(/\{\{OFFER\}\}/g, offer)
    .replace(/\{\{CITY_HINT\}\}/g, hint)
    .replace(/\{\{INVOICE\}\}/g, opts.invoiceUrl ?? "")
    .replace(/\{\{PAYURL\}\}/g, opts.payUrl)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function txt(
  id: string,
  lang: ConvoLang,
  opts: {
    name?: string | null;
    quote?: CatalogQuote;
    payUrl?: string;
    alreadySentPay?: boolean;
    invoiceUrl?: string | null;
    city?: string | null;
    inbound?: string | null;
  } = {},
) {
  const quote = opts.quote ?? quoteFor({ city: opts.city, inbound: opts.inbound });
  return fillTemplate(rawCopy(id, lang, opts.name), {
    lang,
    name: opts.name,
    quote,
    payUrl: opts.payUrl ?? "",
    alreadySentPay: Boolean(opts.alreadySentPay),
    invoiceUrl: opts.invoiceUrl,
  });
}

export { COPY };
