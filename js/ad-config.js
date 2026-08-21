/*
 * NexusXXX advertising configuration.
 *
 * These values match the publisher zone snippets supplied from the ExoClick
 * dashboard. Provider zones are loaded only after the age gate is passed.
 * Normal site navigation is never routed through an ad zone.
 */
window.NEXUS_AD_TARGETS = Object.freeze({
  "player-top": "",
  "player-mid": "",
  "player-related": "",
  "infeed-banner": "",
  "related-banner": "",
  "recommendation": "",
  "sticky-banner": "",
  "interstitial": "",
  "instant-message": ""
});

const NEXUS_EXOCLICK_SCRIPT = "https://a.magsrv.com/ad-provider.js";
const NEXUS_EXOCLICK_PEMS_SCRIPT = "https://a.pemsrv.com/ad-provider.js";

window.NEXUS_EXOCLICK_CONFIG = Object.freeze({
  enabled: true,
  scriptSrc: NEXUS_EXOCLICK_SCRIPT,
  allowedScriptSrcs: Object.freeze([NEXUS_EXOCLICK_SCRIPT, NEXUS_EXOCLICK_PEMS_SCRIPT]),
  slots: Object.freeze({
    // Desktop banner 300x250 zone, with the supplied mobile banner on phones.
    "player-top": Object.freeze({
      variants: Object.freeze({
        desktop: Object.freeze({ zoneId: "6008000", className: "eas6a97888e2", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "banner" }),
        mobile: Object.freeze({ zoneId: "6008010", className: "eas6a97888e10", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "mobile-banner" })
      })
    }),
    // Recommendation/native zone below the player.
    "player-mid": Object.freeze({ zoneId: "6008006", className: "eas6a97888e20", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "recommendation" }),
    // Banner/native zone before the related list.
    "player-related": Object.freeze({
      variants: Object.freeze({
        desktop: Object.freeze({ zoneId: "6008000", className: "eas6a97888e2", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "banner" }),
        mobile: Object.freeze({ zoneId: "6008010", className: "eas6a97888e10", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "mobile-banner" })
      })
    }),
    // Home/Popular/Newest in-feed placement.
    "infeed-banner": Object.freeze({
      variants: Object.freeze({
        desktop: Object.freeze({ zoneId: "6008000", className: "eas6a97888e2", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "banner" }),
        mobile: Object.freeze({ zoneId: "6008010", className: "eas6a97888e10", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "mobile-banner" })
      })
    }),
    // Native recommendation widget used in related/up-next and feed surfaces.
    "related-banner": Object.freeze({ zoneId: "6008006", className: "eas6a97888e20", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "recommendation" }),
    "recommendation": Object.freeze({ zoneId: "6008006", className: "eas6a97888e20", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "recommendation" }),
    // Sticky banner zone supplied for the persistent bottom placement.
    "sticky-banner": Object.freeze({ zoneId: "6008000", className: "eas6a97888e17", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "sticky" }),
    // Responsive fullpage interstitial zones. It is only mounted in the
    // existing explicit internal-navigation interstitial, never on card links.
    "interstitial": Object.freeze({
      variants: Object.freeze({
        desktop: Object.freeze({ zoneId: "6008004", className: "eas6a97888e35", scriptSrc: NEXUS_EXOCLICK_PEMS_SCRIPT, format: "desktop-interstitial" }),
        mobile: Object.freeze({ zoneId: "6008006", className: "eas6a97888e33", scriptSrc: NEXUS_EXOCLICK_PEMS_SCRIPT, format: "mobile-interstitial" })
      })
    }),
    // Responsive instant-message zones mounted after the age gate.
    "instant-message": Object.freeze({
      variants: Object.freeze({
        desktop: Object.freeze({ zoneId: "6008008", className: "eas6a97888e6", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "instant-message" }),
        mobile: Object.freeze({ zoneId: "6008012", className: "eas6a97888e14", scriptSrc: NEXUS_EXOCLICK_SCRIPT, format: "mobile-instant-message" })
      })
    })
  }),
  push: Object.freeze({
    enabled: true,
    zoneId: "6008016",
    workerUrl: "/worker.js",
    sleepSeconds: 0,
    isSelfHosted: 0,
    softAsk: 1,
    softAskHorizontalPosition: "left",
    softAskVerticalPosition: "top",
    softAskTitleEnable: 1
  }),
  vast: Object.freeze({
    enabled: true,
    zoneId: "6008018",
    url: "https://s.magsrv.com/v1/vast.php?id=6008018",
    format: "vast"
  })
});
