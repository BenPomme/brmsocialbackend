#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, cpSync, existsSync, unlinkSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const contentDir = join(root, "content");
const GUIDES = JSON.parse(readFileSync(join(contentDir, "guides.json"), "utf8")).guides;
const srcDir = join(root, "src");
const assetDir = join(root, "assets");
const outDir = join(root, "..", "docs");

const LOCALES = {
  es: {
    name: "ES",
    html: "es",
    slugs: {
      home: "",
      simulator: "simulador",
      how: "como-funciona",
      research: "investigacion",
      about: "nosotros",
      services: "servicios",
      guides: "guias",
      subscribe: "suscribirse",
      account: "cuenta",
      privacy: "privacidad",
      terms: "condiciones",
    },
  },
  ca: {
    name: "CA",
    html: "ca",
    slugs: {
      home: "",
      simulator: "simulador",
      how: "com-funciona",
      research: "recerca",
      about: "nosaltres",
      services: "serveis",
      guides: "guies",
      subscribe: "subscriure",
      account: "compte",
      privacy: "privadesa",
      terms: "condicions",
    },
  },
  fr: {
    name: "FR",
    html: "fr",
    slugs: {
      home: "",
      simulator: "simulateur",
      how: "comment-ca-marche",
      research: "recherche",
      about: "a-propos",
      services: "services",
      guides: "guides",
      subscribe: "s-abonner",
      account: "compte",
      privacy: "confidentialite",
      terms: "conditions",
    },
  },
  en: {
    name: "EN",
    html: "en",
    slugs: {
      home: "",
      simulator: "simulator",
      how: "how-it-works",
      research: "research",
      about: "about",
      services: "services",
      guides: "guides",
      subscribe: "subscribe",
      account: "account",
      privacy: "privacy",
      terms: "terms",
    },
  },
};

function parseMd(text) {
  const map = {};
  let key = null;
  const buf = [];
  for (const line of text.split(/\n/)) {
    const m = line.match(/^##\s+(\S+)\s*$/);
    if (m) {
      if (key) map[key] = buf.join("\n").trim();
      key = m[1];
      buf.length = 0;
    } else buf.push(line);
  }
  if (key) map[key] = buf.join("\n").trim();
  return map;
}

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paras(s) {
  return String(s || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replaceAll("\n", "<br>")}</p>`)
    .join("\n");
}

function homeLead(s) {
  return String(s || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => {
      const lines = p.split("\n");
      const hm = lines[0].match(/^##\s+(.+)$/);
      if (hm) {
        const rest = lines.slice(1).join("\n").trim();
        return `<h2 class="lead-product">${esc(hm[1])}</h2>${rest ? `<p>${esc(rest).replaceAll("\n", "<br>")}</p>` : ""}`;
      }
      return `<p>${esc(p).replaceAll("\n", "<br>")}</p>`;
    })
    .join("\n");
}

function inlineLinks(locale, s) {
  return esc(s)
    .replaceAll("\n", "<br>")
    .replace(/\[([^\]]+)\]\(\[\[page:([a-z]+)\]\]\)/g, (_, label, page) => `<a href="${esc(href(locale, page, 3))}">${label}</a>`)
    .replace(/\[([^\]]+)\]\(\[\[([a-z]+)\]\]\)/g, (_, label, id) => `<a href="${esc(guideHref(locale, id, 3))}">${label}</a>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => `<a href="${esc(url)}" rel="noopener" target="_blank">${label}</a>`);
}

function guideBody(locale, s) {
  return String(s || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => {
      const lines = p.split("\n");
      const hm = lines[0].match(/^##\s+(.+)$/);
      if (hm) {
        const rest = lines.slice(1).join("\n").trim();
        return `<h2>${esc(hm[1])}</h2>${rest ? `<p>${inlineLinks(locale, rest)}</p>` : ""}`;
      }
      return `<p>${inlineLinks(locale, p)}</p>`;
    })
    .join("\n");
}

function t(copy, key) {
  return copy[key] ?? "";
}

function splitStepTitle(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d+)\.\s*(.+)$/);
  if (m) return { n: m[1], title: m[2] };
  return { n: "", title: s };
}

const SITE = "https://www.babyrock.ai";

function href(locale, page, depth) {
  const slug = LOCALES[locale].slugs[page];
  const prefix = "../".repeat(depth);
  return slug ? `${prefix}${locale}/${slug}/` : `${prefix}${locale}/`;
}

function absUrl(locale, page) {
  const slug = LOCALES[locale].slugs[page];
  return slug ? `${SITE}/${locale}/${slug}/` : `${SITE}/${locale}/`;
}

function hreflangLinks(page, absHrefFor) {
  const url = (code) => (absHrefFor ? absHrefFor(code) : absUrl(code, page));
  const tags = Object.keys(LOCALES).map(
    (code) => `  <link rel="alternate" hreflang="${LOCALES[code].html}" href="${url(code)}">`
  );
  tags.push(`  <link rel="alternate" hreflang="x-default" href="${url("en")}">`);
  return tags.join("\n");
}

function jsonLd(locale, page, copy, config, extraGraph) {
  const org = {
    "@type": ["Organization", "LocalBusiness"],
    name: "BabyRock",
    url: SITE + "/",
    email: config.email,
    image: `${SITE}/assets/og.jpg`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Sant Cugat del Vallès",
      addressCountry: "ES",
    },
  };
  const graph = [org];
  if (page === "home") {
    graph.push({
      "@type": "Service",
      name: "BabyRock Social",
      description: t(copy, "meta.description"),
      provider: { "@id": SITE + "/#org" },
      areaServed: ["ES", "FR"],
      offers: [
        { "@type": "Offer", price: String(config.priceMonth), priceCurrency: "EUR", unitText: "MONTH" },
        { "@type": "Offer", price: String(config.priceYear), priceCurrency: "EUR", unitText: "YEAR" },
      ],
    });
    graph.push({
      "@type": "FAQPage",
      mainEntity: [1, 2, 3, 4, 5, 6, 7].map((i) => ({
        "@type": "Question",
        name: t(copy, `home.faq_${i}_q`),
        acceptedAnswer: { "@type": "Answer", text: t(copy, `home.faq_${i}_a`) },
      })),
    });
  }
  if (page === "subscribe") {
    graph.push({
      "@type": "Offer",
      name: "BabyRock Social",
      price: String(config.priceMonth),
      priceCurrency: "EUR",
      url: absUrl(locale, "subscribe"),
    });
  }
  if (extraGraph && extraGraph.length) graph.push(...extraGraph);
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  })}</script>`;
}

function guideExtraLd(locale, g, gcopy) {
  const url = absGuideUrl(locale, g.id);
  const extra = [
    {
      "@type": "Article",
      headline: gcopy.title,
      description: gcopy.dek,
      mainEntityOfPage: url,
      url,
      inLanguage: LOCALES[locale].html,
      image: `${SITE}/assets/illustrations/${g.img}`,
      author: { "@type": "Organization", name: "BabyRock Social" },
      publisher: {
        "@type": "Organization",
        name: "BabyRock Social",
        logo: { "@type": "ImageObject", url: `${SITE}/assets/og.jpg` },
      },
    },
  ];
  const faq = [];
  const blocks = String(gcopy.body || "").split(/\n\s*\n/);
  const stripMd = (s) =>
    String(s || "")
      .replace(/\[([^\]]+)\]\(\[\[[^\]]+\]\]\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split("\n");
    const hm = lines[0] && lines[0].match(/^##\s+(.+)$/);
    if (!hm) continue;
    const q = hm[1].trim();
    if (!q.includes("?")) continue;
    let a = stripMd(lines.slice(1).join(" "));
    if (!a && i + 1 < blocks.length && !/^##\s+/.test(blocks[i + 1])) {
      a = stripMd(blocks[i + 1]);
    }
    if (!a) continue;
    faq.push({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    });
  }
  if (faq.length) extra.push({ "@type": "FAQPage", mainEntity: faq });
  return extra;
}

function langSwitcher(locale, page, depth, hrefFor) {
  return Object.keys(LOCALES)
    .map((code) => {
      const current = code === locale ? ' aria-current="true"' : "";
      const url = hrefFor ? hrefFor(code, depth) : href(code, page, depth);
      return `<a href="${url}"${current}>${LOCALES[code].name}</a>`;
    })
    .join("");
}

function nav(locale, page, copy, depth, config) {
  const item = (key, slugKey) => {
    const current = page === slugKey ? ' aria-current="page"' : "";
    return `<a href="${href(locale, slugKey, depth)}"${current}>${esc(t(copy, key))}</a>`;
  };
  return `
    ${item("nav.services", "services")}
    ${item("nav.guides", "guides")}
    ${item("nav.simulator", "simulator")}
    ${item("nav.how", "how")}
    ${item("nav.research", "research")}
    ${item("nav.about", "about")}
    ${item("nav.account", "account")}
  `;
}

function mailLink(config, subject) {
  const email = String(config.email || "").trim();
  const sub = encodeURIComponent(subject || "BabyRock Social");
  return `mailto:${email}?subject=${sub}`;
}

function waLink(config, text) {
  const msg = encodeURIComponent(text || "Hola Rosalia");
  const digits = String(config.whatsapp || "").replace(/\D/g, "");
  if (digits) return `https://wa.me/${digits}?text=${msg}`;
  return `mailto:${config.email}?subject=${encodeURIComponent("BabyRock Social")}&body=${msg}`;
}

function waIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
}

function asset(depth, path) {
  return `${"../".repeat(depth)}assets/${path}`;
}

function cssJs(depth) {
  const p = "../".repeat(depth);
  return {
    css: `${p}css/site.css`,
    js: `${p}js/site.js`,
  };
}

function gaSnippet(config) {
  const id = String(config.gaId || "").trim();
  if (!/^G-[A-Z0-9]+$/i.test(id)) return "";
  const safe = esc(id);
  return `
  <link rel="preconnect" href="https://www.googletagmanager.com">
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      wait_for_update: 500
    });
    gtag('js', new Date());
    gtag('config', '${safe}');
  </script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=${safe}"></script>`;
}

function consentBanner(copy, locale, depth) {
  return `<div class="cookie-banner" data-cookie-banner hidden>
    <h2>${esc(t(copy, "cookies.title"))}</h2>
    <p>${esc(t(copy, "cookies.body"))} <a href="${href(locale, "privacy", depth)}">${esc(t(copy, "footer.privacy"))}</a>.</p>
    <div class="cookie-actions">
      <button type="button" class="btn btn-coral" data-cookie-accept>${esc(t(copy, "cookies.accept"))}</button>
      <button type="button" class="btn btn-ghost" data-cookie-refuse>${esc(t(copy, "cookies.refuse"))}</button>
    </div>
  </div>`;
}

function trustBar(copy, config) {
  const n = Number(config.trustCount) || 500;
  const raw = t(copy, "home.trust") || "";
  const html = esc(raw).replace("{n}", `<span data-trust-count>${n}</span>`);
  return `<div class="trust-wrap"><p class="wrap trust-bar" data-trust-ticker data-trust-base="${n}">${html}</p></div>`;
}

function faviconLinks(depth) {
  const root = depth ? "../".repeat(depth) : "./";
  return `  <link rel="icon" href="${root}favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="48x48" href="${asset(depth, "favicon-48.png")}">
  <link rel="icon" type="image/png" sizes="192x192" href="${asset(depth, "favicon-192.png")}">
  <link rel="apple-touch-icon" href="${root}apple-touch-icon.png">`;
}

function shell({ locale, page, copy, config, depth, title, description, body, langHref, canonicalUrl, hreflangAbs, extraGraph, ogType }) {
  const { css, js } = cssJs(depth);
  const navHtml = nav(locale, page, copy, depth, config);
  const wa = waLink(config, t(copy, "wa.prefill"));
  const canonical = canonicalUrl || absUrl(locale, page);
  const ogImage = `${SITE}/assets/og.jpg`;
  const robots = page === "account" ? "noindex,follow" : "index,follow";
  return `<!doctype html>
<html lang="${LOCALES[locale].html}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${canonical}">
${faviconLinks(depth)}
${hreflangLinks(page, hreflangAbs)}
  <meta property="og:type" content="${esc(ogType || "website")}">
  <meta property="og:site_name" content="BabyRock Social">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:locale" content="${locale === "en" ? "en_GB" : locale === "ca" ? "ca_ES" : locale === "fr" ? "fr_FR" : "es_ES"}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${css}">
  ${jsonLd(locale, page, copy, config, extraGraph)}
  ${gaSnippet(config)}
</head>
<body>
  <a class="skip" href="#main">${esc(t(copy, "nav.skip") || "Skip")}</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="logo" href="${href(locale, "home", depth)}"><img class="logo-mark" src="${asset(depth, "favicon-192.png")}" alt="" width="28" height="28">BabyRock</a>
      <nav class="nav-links">${navHtml}</nav>
      <div class="header-actions">
        <div class="lang">${langSwitcher(locale, page, depth, langHref)}</div>
        <a class="btn btn-wa" href="${wa}" target="_blank" rel="noopener">${waIcon()} ${esc(t(copy, "nav.whatsapp"))}</a>
        <a class="btn btn-coral" href="${href(locale, "subscribe", depth)}">${esc(t(copy, "nav.subscribe"))}</a>
        <button class="menu-toggle" type="button" data-menu aria-expanded="false" aria-label="${esc(t(copy, "nav.menu"))}"><span></span><span></span><span></span></button>
      </div>
    </div>
    <nav class="mobile-nav wrap" data-mobile-nav>
      ${navHtml}
      <a class="btn btn-wa" href="${wa}" target="_blank" rel="noopener">${waIcon()} ${esc(t(copy, "nav.whatsapp"))}</a>
    </nav>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <p class="logo">BabyRock</p>
        ${paras(t(copy, "footer.tagline"))}
        <p>${esc(t(copy, "footer.city"))}</p>
      </div>
      <div>
        <p><a href="${href(locale, "services", depth)}">${esc(t(copy, "nav.services"))}</a></p>
        <p><a href="${href(locale, "guides", depth)}">${esc(t(copy, "nav.guides"))}</a></p>
        <p><a href="${href(locale, "simulator", depth)}">${esc(t(copy, "nav.simulator"))}</a></p>
        <p><a href="${href(locale, "how", depth)}">${esc(t(copy, "nav.how"))}</a></p>
        <p><a href="${href(locale, "research", depth)}">${esc(t(copy, "nav.research"))}</a></p>
        <p><a href="${href(locale, "about", depth)}">${esc(t(copy, "nav.about"))}</a></p>
      </div>
      <div>
        <p><a href="${href(locale, "subscribe", depth)}">${esc(t(copy, "nav.subscribe"))}</a></p>
        <p><a href="${href(locale, "account", depth)}">${esc(t(copy, "nav.account"))}</a></p>
        <p><a href="${href(locale, "privacy", depth)}">${esc(t(copy, "footer.privacy"))}</a></p>
        <p><a href="${href(locale, "terms", depth)}">${esc(t(copy, "footer.terms"))}</a></p>
        <p><a href="${href(locale, "privacy", depth)}" data-cookie-open>${esc(t(copy, "footer.cookies"))}</a></p>
        <p><a href="${wa}" target="_blank" rel="noopener">${esc(t(copy, "nav.whatsapp"))} · Rosalia</a></p>
        <p><a href="mailto:${esc(config.email)}">${esc(config.email)}</a></p>
      </div>
    </div>
  </footer>
  ${consentBanner(copy, locale, depth)}
  <a class="wa-fab" href="${wa}" target="_blank" rel="noopener" aria-label="${esc(t(copy, "nav.whatsapp"))} Rosalia">
    ${waIcon()}
  </a>
  <script>window.BR_CONFIG = ${JSON.stringify(config)};</script>
  <script src="${js}"></script>
</body>
</html>`;
}

function shops(copy, depth) {
  const items = [
    ["shop-restaurant.jpg", "home.shop_restaurant"],
    ["shop-bakery.jpg", "home.shop_bakery"],
    ["shop-salon.jpg", "home.shop_salon"],
    ["shop-florist.jpg", "home.shop_florist"],
    ["shop-cafe.jpg", "home.shop_cafe"],
    ["shop-workshop.jpg", "home.shop_workshop"],
    ["shop-clinic.jpg", "home.shop_clinic"],
    ["shop-physio.jpg", "home.shop_physio"],
    ["shop-club.jpg", "home.shop_club"],
  ];
  return items
    .map(
      ([img, key]) => `<figure class="photo-card"><img src="${asset(depth, "illustrations/" + img)}" alt="" loading="lazy"><figcaption>${esc(t(copy, key))}</figcaption></figure>`
    )
    .join("");
}

const KIND_ORDER = ["restaurant", "cafe", "bakery", "salon", "florist", "workshop", "clinic", "physio", "club"];

function pctLabel(n) {
  const x = Math.round(n * 1000) / 10;
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

function simProducts(copy) {
  const items = [
    ["social", "product.social_name", "sim.product_social_sub"],
    ["direct", "product.direct_name", "sim.product_direct_sub"],
    ["both", "sim.product_both", "sim.product_both_sub"],
  ];
  return `<fieldset class="sim-products">
    <legend>${esc(t(copy, "sim.product"))}</legend>
    <div class="sim-product-row">
      ${items
        .map(
          ([value, nameKey, subKey], i) => `<label class="sim-product">
        <input type="radio" name="product" value="${value}"${i === 0 ? " checked" : ""}>
        <span><strong>${esc(t(copy, nameKey))}</strong><em>${esc(t(copy, subKey))}</em></span>
      </label>`
        )
        .join("")}
    </div>
  </fieldset>`;
}

function simOutcomes(copy) {
  return `<div class="sim-outcomes">
    <div class="sim-out sim-out-low">
      <p class="tiny">${esc(t(copy, "sim.low_label"))}</p>
      <p class="big" data-sim-low>-</p>
      <p class="tiny"><span data-sim-low-pct></span> ${esc(t(copy, "sim.pct_of_year"))}</p>
    </div>
    <div class="sim-out sim-out-high">
      <p class="tiny">${esc(t(copy, "sim.high_label"))}</p>
      <p class="big" data-sim-high>-</p>
      <p class="tiny"><span data-sim-high-pct></span> ${esc(t(copy, "sim.pct_of_year"))}</p>
    </div>
  </div>
  <p class="tiny sim-note">${esc(t(copy, "sim.note"))}</p>`;
}

function compactSim(locale, copy, depth) {
  const kinds = KIND_ORDER.map(
    (k) => `<option value="${k}"${k === "restaurant" ? " selected" : ""}>${esc(t(copy, "sim.kind_" + k))}</option>`
  ).join("");
  return `<form class="sim-card sim-card-home" data-sim>
    <h2>${esc(t(copy, "home.sim_title"))}</h2>
    ${paras(t(copy, "home.sim_lead"))}
    <label for="rev">${esc(t(copy, "home.sim_label"))}</label>
    <input id="rev" name="revenue" inputmode="numeric" placeholder="${esc(t(copy, "home.sim_placeholder"))}" value="${esc(t(copy, "home.sim_placeholder"))}">
    <label for="kind">${esc(t(copy, "sim.kind"))}</label>
    <select id="kind" name="kind">${kinds}</select>
    ${simProducts(copy)}
    ${simOutcomes(copy)}
    <p class="sim-links">
      <a href="${href(locale, "research", depth)}">${esc(t(copy, "sim.research_link"))}</a>
      ·
      <a href="${href(locale, "simulator", depth)}">${esc(t(copy, "home.sim_link"))}</a>
    </p>
  </form>`;
}

function homePage(locale, copy, config, depth) {
  return `
  ${trustBar(copy, config)}
  <section class="hero-stage">
    <div class="wrap hero-split">
      <div class="hero-panel">
        <p class="kicker">${esc(t(copy, "home.kicker"))}</p>
        <h1 class="hero-title">${esc(t(copy, "home.headline"))}</h1>
        <div class="lead">${homeLead(t(copy, "home.lead"))}</div>
        <div class="cta-row">
          <a class="btn btn-wa" href="${waLink(config, t(copy, "wa.prefill"))}" target="_blank" rel="noopener">${waIcon()} ${esc(t(copy, "nav.whatsapp"))}</a>
          <a class="btn btn-coral" href="${mailLink(config)}">${esc(t(copy, "home.cta_sub"))}</a>
          <a class="btn btn-ghost" href="${href(locale, "simulator", depth)}">${esc(t(copy, "home.cta_sim"))}</a>
        </div>
      </div>
      <figure class="hero-visual"><img class="hero-photo" src="${asset(depth, "illustrations/hero.jpg")}" alt=""></figure>
    </div>
  </section>
  <section class="section" id="productos">
    <div class="wrap">
      <h2>${esc(t(copy, "home.products_title"))}</h2>
      ${paras(t(copy, "home.products_lead"))}
      ${compareProducts(locale, copy, config, depth)}
      <p style="margin-top:1rem"><a href="${href(locale, "services", depth)}">${esc(t(copy, "nav.services"))}</a></p>
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      <h2>${esc(t(copy, "home.for_whom_title"))}</h2>
      ${paras(t(copy, "home.for_whom_lead"))}
      <div class="shops">${shops(copy, depth)}</div>
    </div>
  </section>
  <section class="section section-alt" id="sim">
    <div class="wrap">${compactSim(locale, copy, depth)}</div>
  </section>
  <section class="section">
    <div class="wrap value-grid">
      <article class="value-card"><h3>${esc(t(copy, "home.value_time_title"))}</h3>${paras(t(copy, "home.value_time"))}</article>
      <article class="value-card"><h3>${esc(t(copy, "home.value_trust_title"))}</h3>${paras(t(copy, "home.value_trust"))}</article>
      <article class="value-card"><h3>${esc(t(copy, "home.value_rating_title"))}</h3>${paras(t(copy, "home.value_rating"))}</article>
    </div>
  </section>
  <section class="section">
    <div class="wrap human">
      <figure class="portrait"><img src="${asset(depth, "portraits/rosalia.jpg")}" alt="Rosalia"></figure>
      <div class="human-copy">
        <h2>${esc(t(copy, "home.human_title"))}</h2>
        ${paras(t(copy, "home.human"))}
        ${paras(t(copy, "home.whatsapp_line"))}
      </div>
    </div>
  </section>
  <section class="section section-alt">
    <div class="wrap">
      <h2>${esc(t(copy, "home.price_title"))}</h2>
      <div class="price-grid">
        <article class="price-card">
          <h3>${esc(t(copy, "home.price_month_name"))}</h3>
          <p class="amount">${esc(config.priceMonth)} €</p>
          ${paras(t(copy, "home.price_month_detail"))}
        </article>
        <article class="price-card featured">
          <h3>${esc(t(copy, "home.price_year_name"))} <span class="save">${esc(t(copy, "home.price_year_save"))}</span></h3>
          <p class="amount">${esc(config.priceYear)} €</p>
          ${paras(t(copy, "home.price_year_detail"))}
        </article>
      </div>
      ${paras(t(copy, "home.price_setup"))}
    </div>
  </section>
  <section class="section">
    <div class="wrap faq">
      <h2>${esc(t(copy, "home.faq_title"))}</h2>
      ${[1, 2, 3, 4, 5, 6, 7]
        .map(
          (i) => `<details><summary>${esc(t(copy, "home.faq_" + i + "_q"))}</summary>${paras(t(copy, "home.faq_" + i + "_a"))}</details>`
        )
        .join("")}
    </div>
  </section>`;
}

function simulatorPage(locale, copy, depth) {
  const chips = KIND_ORDER.map(
    (k) => `<label class="sim-chip">
      <input type="radio" name="kind" value="${k}"${k === "restaurant" ? " checked" : ""}>
      <span>${esc(t(copy, "sim.kind_" + k))}</span>
    </label>`
  ).join("");
  return `
  <section class="wrap section">
    <h1>${esc(t(copy, "sim.headline"))}</h1>
    <div class="lead">${paras(t(copy, "sim.lead"))}</div>
    <form class="sim-card sim-card-full" data-sim>
      <label>${esc(t(copy, "sim.revenue"))}
        <input name="revenue" inputmode="numeric" placeholder="${esc(t(copy, "home.sim_placeholder"))}" value="${esc(t(copy, "home.sim_placeholder"))}">
      </label>
      <fieldset class="sim-kinds">
        <legend>${esc(t(copy, "sim.kind"))}</legend>
        <div class="sim-chip-row">${chips}</div>
      </fieldset>
      ${simProducts(copy)}
      ${simOutcomes(copy)}
      <div class="cta-row">
        <a class="btn btn-coral" href="${href(locale, "subscribe", depth)}">${esc(t(copy, "sim.cta"))}</a>
        <a class="btn btn-ghost" href="${href(locale, "research", depth)}">${esc(t(copy, "sim.research_link"))}</a>
      </div>
    </form>
  </section>`;
}

function howPage(locale, copy, depth) {
  const steps = [
    ["step-whatsapp.jpg", "how.step1_title", "how.step1"],
    ["step-manager.jpg", "how.step2_title", "how.step2"],
    ["step-write.jpg", "how.step3_title", "how.step3"],
    ["step-recap.jpg", "how.step4_title", "how.step4"],
  ];
  return `
  <section class="wrap section">
    <h1>${esc(t(copy, "how.headline"))}</h1>
    <div class="lead">${paras(t(copy, "how.lead"))}</div>
    <div class="step-grid">
      ${steps
        .map(([img, titleKey, body], i) => {
          const { n, title } = splitStepTitle(t(copy, titleKey));
          const num = n || String(i + 1);
          const videoLabel = t(copy, "how.step2_video");
          const video = i === 1
            ? `<figure class="story-video">
          <video controls playsinline preload="metadata" poster="${asset(depth, `videos/manager-${locale}.jpg`)}" title="${esc(videoLabel)}" aria-label="${esc(videoLabel)}" width="1080" height="1920">
            <source src="${asset(depth, `videos/manager-${locale}.mp4`)}" type="video/mp4">
          </video>
        </figure>`
            : "";
          return `<details class="story-card"${i === 1 ? " open" : ""}>
        <summary>
          <img src="${asset(depth, "illustrations/" + img)}" alt="" width="72" height="72" loading="lazy">
          <span class="story-num">${esc(num)}</span>
          <h3>${esc(title)}</h3>
        </summary>
        <div class="story-copy">
          ${paras(t(copy, body))}
          ${video}
        </div>
      </details>`;
        })
        .join("")}
    </div>
    <div class="note" style="margin-top:1.5rem">${paras(t(copy, "how.ai_box"))}${paras(t(copy, "how.whatsapp"))}</div>
  </section>`;
}

function impactTable(copy, config) {
  const impact = config.impact || { social: {}, direct: {}, overlap: 0.85 };
  const o = impact.overlap == null ? 0.85 : impact.overlap;
  const rows = KIND_ORDER.map((k) => {
    const social = impact.social[k] || [0, 0];
    const direct = impact.direct[k] || [0, 0];
    const bothLow = social[0] + o * direct[0];
    const bothHigh = social[1] + o * direct[1];
    return `<tr>
      <th scope="row">${esc(t(copy, "sim.kind_" + k))}</th>
      <td>${pctLabel(social[0])}–${pctLabel(social[1])}%</td>
      <td>${pctLabel(direct[0])}–${pctLabel(direct[1])}%</td>
      <td>${pctLabel(bothLow)}–${pctLabel(bothHigh)}%</td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="impact-table">
    <thead><tr>
      <th></th>
      <th>${esc(t(copy, "product.social_name"))}</th>
      <th>${esc(t(copy, "product.direct_name"))}</th>
      <th>${esc(t(copy, "sim.product_both"))}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function researchPage(copy, config) {
  return `
  <section class="wrap section research prose">
    <h1>${esc(t(copy, "research.headline"))}</h1>
    <div class="lead">${paras(t(copy, "research.lead"))}</div>
    <article><h2>${esc(t(copy, "research.luca_title"))}</h2>${paras(t(copy, "research.luca"))}</article>
    <article><h2>${esc(t(copy, "research.womply_title"))}</h2>${paras(t(copy, "research.womply"))}</article>
    <article><h2>${esc(t(copy, "research.direct_title"))}</h2>${paras(t(copy, "research.direct"))}</article>
    <article><h2>${esc(t(copy, "research.formula_title"))}</h2>${paras(t(copy, "research.formula"))}${impactTable(copy, config)}</article>
    <article>${paras(t(copy, "research.what_we_use"))}</article>
  </section>`;
}

function aboutPage(copy, depth) {
  return `
  <section class="wrap section">
    <h1>${esc(t(copy, "about.headline"))}</h1>
    <div class="lead">${paras(t(copy, "about.lead"))}</div>
    <div class="team-grid">
      <article>
        <figure class="portrait"><img src="${asset(depth, "portraits/rosalia.jpg")}" alt="Rosalia"></figure>
        <h2>${esc(t(copy, "about.rosalia_role"))}</h2>
        ${paras(t(copy, "about.rosalia"))}
      </article>
      <article>
        <figure class="portrait"><img src="${asset(depth, "portraits/ben.jpg")}" alt="Benjamin Pommeraud"></figure>
        <h2>${esc(t(copy, "about.ben_role"))}</h2>
        ${paras(t(copy, "about.ben"))}
      </article>
    </div>
    <div class="note" style="margin-top:2rem">
      <h2>${esc(t(copy, "about.human_title"))}</h2>
      ${paras(t(copy, "about.human"))}
      ${paras(t(copy, "about.whatsapp"))}
    </div>
  </section>`;
}

function readGuide(locale, id) {
  const p = join(contentDir, "guides", locale, `${id}.md`);
  const fb = join(contentDir, "guides", "es", `${id}.md`);
  return parseMd(readFileSync(existsSync(p) ? p : fb, "utf8"));
}

function guideHref(locale, id, depth) {
  const prefix = "../".repeat(depth);
  const index = LOCALES[locale].slugs.guides;
  const slug = GUIDES.find((g) => g.id === id).slugs[locale];
  return `${prefix}${locale}/${index}/${slug}/`;
}

function absGuideUrl(locale, id) {
  const index = LOCALES[locale].slugs.guides;
  const slug = GUIDES.find((g) => g.id === id).slugs[locale];
  return `${SITE}/${locale}/${index}/${slug}/`;
}

function sourceList(raw) {
  return `<ul class="sources">${String(raw || "")
    .split(/\n/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\[(.+)\]\((https?:\/\/[^)]+)\)\s*(.*)$/);
      if (!m) return `<li>${esc(line)}</li>`;
      const rest = m[3] ? ` ${esc(m[3])}` : "";
      return `<li><a href="${esc(m[2])}" rel="noopener" target="_blank">${esc(m[1])}</a>${rest}</li>`;
    })
    .join("")}</ul>`;
}

function guidesIndexPage(locale, copy, config, depth) {
  const cards = GUIDES.map((g) => {
    const gcopy = readGuide(locale, g.id);
    return `<article class="guide-card"><a href="${guideHref(locale, g.id, depth)}">
      <img src="${asset(depth, "illustrations/" + g.img)}" alt="" loading="lazy">
      <h3>${esc(gcopy.title)}</h3>
      <p>${esc(gcopy.dek)}</p>
    </a></article>`;
  }).join("");
  return `
  <section class="wrap section">
    <h1>${esc(t(copy, "guides.headline"))}</h1>
    <div class="lead">${paras(t(copy, "guides.lead"))}</div>
    <div class="guide-grid">${cards}</div>
  </section>`;
}

function guideArticlePage(locale, copy, config, depth, id) {
  const g = GUIDES.find((x) => x.id === id);
  const gcopy = readGuide(locale, id);
  const wa = waLink(config, gcopy.wa_prefill);
  return `
  <article class="wrap section guide-article">
    <p class="kicker"><a href="${href(locale, "guides", depth)}">${esc(t(copy, "nav.guides"))}</a></p>
    <h1>${esc(gcopy.title)}</h1>
    <div class="lead">${paras(gcopy.dek)}</div>
    <figure class="guide-hero"><img src="${asset(depth, "illustrations/" + g.img)}" alt=""></figure>
    <aside class="impact-box">
      <p class="tiny">${esc(gcopy.impact_label)}</p>
      ${paras(gcopy.impact)}
    </aside>
    ${guideBody(locale, gcopy.body)}
    <h2>${esc(t(copy, "guides.sources"))}</h2>
    ${sourceList(gcopy.sources)}
    <p class="cta-row" style="margin-top:1.5rem">
      <a class="btn btn-wa" href="${wa}" target="_blank" rel="noopener">${waIcon()} ${esc(t(copy, "nav.whatsapp"))} Rosalia</a>
      <a class="btn btn-coral" href="${mailLink(config)}">${esc(t(copy, "home.cta_sub"))}</a>
    </p>
  </article>`;
}

function checkIcon(soon) {
  const c = soon ? "#6a645c" : "#3c9a4e";
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="9" stroke="${c}" stroke-width="1.6"/><path d="M6 10.2l2.3 2.3L14 7.6" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function featureItems(copy, prefix, n, soon) {
  return Array.from({ length: n }, (_, i) => {
    const k = `${prefix}_f${i + 1}`;
    return `<li>${checkIcon(soon)}<div><strong>${esc(t(copy, `${k}_title`))}</strong><span>${esc(t(copy, k))}</span></div></li>`;
  }).join("");
}

function compareProducts(locale, copy, config, depth) {
  const socialCta = href(locale, "subscribe", depth);
  const directCta = waLink(config, t(copy, "product.direct_prefill"));
  return `<div class="compare">
    <article class="compare-card live">
      <div class="compare-head">
        <img src="${asset(depth, "logos/social-icon.svg")}" alt="" width="52" height="52">
        <h2 class="compare-name">${esc(t(copy, "product.social_name"))} <em>${esc(t(copy, "product.social_status"))}</em></h2>
      </div>
      <p class="compare-tag">${esc(t(copy, "product.social_tag"))}</p>
      <p class="compare-price">${esc(config.priceMonth)} € <small>${esc(t(copy, "product.social_price_unit"))}</small></p>
      <p class="compare-price-note">${esc(t(copy, "product.social_price_detail"))}</p>
      <a class="btn btn-coral compare-cta" href="${socialCta}">${esc(t(copy, "products.social_cta"))}</a>
      <ul class="compare-features">${featureItems(copy, "product.social", 5, false)}</ul>
    </article>
    <article class="compare-card soon">
      <div class="compare-head">
        <img src="${asset(depth, "logos/direct-icon.svg")}" alt="" width="52" height="52">
        <h2 class="compare-name">${esc(t(copy, "product.direct_name"))} <em>${esc(t(copy, "product.direct_status"))}</em></h2>
      </div>
      <p class="compare-tag">${esc(t(copy, "product.direct_tag"))}</p>
      <a class="btn btn-ghost compare-cta" href="${directCta}" target="_blank" rel="noopener">${esc(t(copy, "products.direct_cta"))}</a>
      <ul class="compare-features">${featureItems(copy, "product.direct", 4, true)}</ul>
      <p class="compare-later">${esc(t(copy, "product.direct_later"))}</p>
    </article>
  </div>
  <p class="compare-offer">${esc(t(copy, "products.offer"))}</p>`;
}

function servicesPage(locale, copy, config, depth) {
  return `
  <section class="wrap section products-page">
    <p class="kicker">${esc(t(copy, "nav.services"))}</p>
    <h1 class="products-title">${esc(t(copy, "products.headline"))}</h1>
    <div class="lead products-lead">${paras(t(copy, "products.lead"))}</div>
    ${compareProducts(locale, copy, config, depth)}
  </section>`;
}

function subscribePage(locale, copy, config, depth) {
  return `
  <section class="wrap section">
    <h1>${esc(t(copy, "sub.headline"))}</h1>
    <div class="lead">${paras(t(copy, "sub.lead"))}</div>
    <p class="note">${esc(t(copy, "product.social_name"))}: ${esc(t(copy, "product.social_status"))}. ${esc(t(copy, "product.direct_name"))}: ${esc(t(copy, "product.direct_status"))}.</p>
    <div class="price-grid">
      <article class="price-card"><h3>${esc(t(copy, "home.price_month_name"))}</h3><p class="amount">${esc(config.priceMonth)} €</p><p>${esc(t(copy, "sub.month"))}</p></article>
      <article class="price-card featured"><h3>${esc(t(copy, "home.price_year_name"))}</h3><p class="amount">${esc(config.priceYear)} €</p><p>${esc(t(copy, "sub.year"))}</p></article>
    </div>
    <p class="cta-row" style="margin:1.25rem 0 0">
      <a class="btn btn-wa" href="${waLink(config, t(copy, "wa.prefill"))}" target="_blank" rel="noopener">${waIcon()} ${esc(t(copy, "sub.cta_wa"))}</a>
    </p>
    <form class="sim-card form-grid" data-interest-form data-wa="" data-mail="${esc(config.email)}" style="margin-top:1.5rem">
      <label>${esc(t(copy, "sub.form_name"))}<input name="business" required></label>
      <label>${esc(t(copy, "sub.form_city"))}<input name="city"></label>
      <label>${esc(t(copy, "sub.form_listing"))}<input name="listing"></label>
      <label>${esc(t(copy, "sub.form_email"))}<input name="email" type="email" required></label>
      <label>${esc(t(copy, "sub.form_wa"))}<input name="whatsapp"></label>
      <label>${esc(t(copy, "sub.form_revenue"))}<input name="revenue" inputmode="numeric"></label>
      <label>${esc(t(copy, "sub.form_plan"))}
        <select name="plan">
          <option value="month">${esc(t(copy, "sub.plan_month"))}</option>
          <option value="year">${esc(t(copy, "sub.plan_year"))}</option>
        </select>
      </label>
      <div class="cta-row">
        <button class="btn btn-ghost" name="channel" value="email" type="submit">${esc(t(copy, "sub.cta_email"))}</button>
      </div>
    </form>
    ${paras(t(copy, "sub.after"))}
  </section>`;
}

function accountPage(locale, copy, config, depth) {
  const wa = waLink(config, "BAJA");
  return `
  <section class="wrap section prose">
    <h1>${esc(t(copy, "account.headline"))}</h1>
    <div class="lead">${paras(t(copy, "account.lead"))}</div>
    <h2>${esc(t(copy, "account.contacts_title"))}</h2>
    ${paras(t(copy, "account.contacts"))}
    <h2>${esc(t(copy, "account.invoices_title"))}</h2>
    ${paras(t(copy, "account.invoices"))}
    <h2>${esc(t(copy, "account.pay_title"))}</h2>
    ${paras(t(copy, "account.pay"))}
    <h2>${esc(t(copy, "account.cancel_title"))}</h2>
    ${paras(t(copy, "account.cancel"))}
    <h2>${esc(t(copy, "account.listing_title"))}</h2>
    ${paras(t(copy, "account.listing"))}
    <p><a class="btn btn-coral" href="${wa}">${esc(t(copy, "account.cta_cancel"))}</a></p>
  </section>`;
}

function legalPage(copy, headKey, bodyKey) {
  return `<section class="wrap section prose"><h1>${esc(t(copy, headKey))}</h1>${paras(t(copy, bodyKey))}</section>`;
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function pagePath(locale, page) {
  const slug = LOCALES[locale].slugs[page];
  return slug ? join(outDir, locale, slug, "index.html") : join(outDir, locale, "index.html");
}

const config = JSON.parse(readFileSync(join(contentDir, "config.json"), "utf8"));
const css = readFileSync(join(srcDir, "styles.css"), "utf8");
const js = readFileSync(join(srcDir, "site.js"), "utf8");

mkdirSync(join(outDir, "css"), { recursive: true });
mkdirSync(join(outDir, "js"), { recursive: true });
writeFileSync(join(outDir, "css", "site.css"), css);
writeFileSync(join(outDir, "js", "site.js"), js);
if (existsSync(assetDir)) {
  cpSync(assetDir, join(outDir, "assets"), { recursive: true });
  for (const extra of ["portraits/rosalia-source.jpg", "portraits/ben-source.png"]) {
    const p = join(outDir, "assets", extra);
    try {
      unlinkSync(p);
    } catch {}
  }
  for (const f of ["favicon.ico", "apple-touch-icon.png"]) {
    const src = join(assetDir, f);
    if (existsSync(src)) copyFileSync(src, join(outDir, f));
  }
}
writeFileSync(join(outDir, "CNAME"), "www.babyrock.ai\n");
writeFileSync(join(outDir, ".nojekyll"), "");
writeFileSync(
  join(outDir, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`
);
const indexable = ["home", "services", "guides", "simulator", "how", "research", "about", "subscribe", "privacy", "terms"];
const sitemapUrls = Object.keys(LOCALES).flatMap((locale) => [
  ...indexable.map((page) => `  <url><loc>${absUrl(locale, page)}</loc></url>`),
  ...GUIDES.map((g) => `  <url><loc>${absGuideUrl(locale, g.id)}</loc></url>`),
]);
writeFileSync(
  join(outDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.join("\n")}\n</urlset>\n`
);

for (const locale of Object.keys(LOCALES)) {
  const copy = parseMd(readFileSync(join(contentDir, `${locale}.md`), "utf8"));
  const pages = {
    home: { depth: 1, body: homePage(locale, copy, config, 1) },
    services: { depth: 2, body: servicesPage(locale, copy, config, 2) },
    guides: { depth: 2, body: guidesIndexPage(locale, copy, config, 2) },
    simulator: { depth: 2, body: simulatorPage(locale, copy, 2) },
    how: { depth: 2, body: howPage(locale, copy, 2) },
    research: { depth: 2, body: researchPage(copy, config) },
    about: { depth: 2, body: aboutPage(copy, 2) },
    subscribe: { depth: 2, body: subscribePage(locale, copy, config, 2) },
    account: { depth: 2, body: accountPage(locale, copy, config, 2) },
    privacy: { depth: 2, body: legalPage(copy, "privacy.headline", "privacy.body") },
    terms: { depth: 2, body: legalPage(copy, "terms.headline", "terms.body") },
  };
  for (const [page, meta] of Object.entries(pages)) {
    write(
      pagePath(locale, page),
      shell({
        locale,
        page,
        copy,
        config,
        depth: meta.depth,
        title: page === "services" ? `${t(copy, "product.social_name")} · ${t(copy, "product.direct_name")} | BabyRock` : t(copy, "meta.title"),
        description: page === "services" ? t(copy, "products.lead").split(/\n\s*\n/)[0] : t(copy, "meta.description"),
        body: meta.body,
      })
    );
  }
  for (const g of GUIDES) {
    const gcopy = readGuide(locale, g.id);
    const slug = g.slugs[locale];
    const index = LOCALES[locale].slugs.guides;
    write(
      join(outDir, locale, index, slug, "index.html"),
      shell({
        locale,
        page: "guides",
        copy,
        config,
        depth: 3,
        title: `${gcopy.title} | BabyRock`,
        description: gcopy.dek,
        body: guideArticlePage(locale, copy, config, 3, g.id),
        langHref: (code) => guideHref(code, g.id, 3),
        canonicalUrl: absGuideUrl(locale, g.id),
        hreflangAbs: (code) => absGuideUrl(code, g.id),
        extraGraph: guideExtraLd(locale, g, gcopy),
        ogType: "article",
      })
    );
  }
}

write(
  join(outDir, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BabyRock Social</title>
  <meta name="description" content="Thoughtful Google review replies for small businesses. From €99/month.">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon-48.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="canonical" href="${SITE}/en/">
  <link rel="alternate" hreflang="en" href="${SITE}/en/">
  <link rel="alternate" hreflang="es" href="${SITE}/es/">
  <link rel="alternate" hreflang="ca" href="${SITE}/ca/">
  <link rel="alternate" hreflang="fr" href="${SITE}/fr/">
  <link rel="alternate" hreflang="x-default" href="${SITE}/en/">
  <meta http-equiv="refresh" content="0;url=/en/">
</head>
<body>
  <p><a href="/en/">English</a> · <a href="/es/">Español</a> · <a href="/ca/">Català</a> · <a href="/fr/">Français</a></p>
<script>
const map = {es:"es",ca:"ca",fr:"fr",en:"en"};
const lang = (navigator.languages || [navigator.language || "en"]).map(l => l.slice(0,2).toLowerCase());
const hit = lang.find(l => map[l]) || "en";
location.replace("./" + hit + "/");
</script>
</body>
</html>`
);

console.log("Built static site into docs/");
