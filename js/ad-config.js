/*
 * NexusXXX advertising configuration.
 *
 * Destination URLs remain optional and inert when empty. ExoClick is also
 * opt-in: keep enabled=false until the approved publisher zone code is
 * configured from the ExoClick dashboard. Do not paste popup/popunder code
 * into card links or navigation handlers.
 */
window.NEXUS_AD_TARGETS = Object.freeze({
  "player-top": "",
  "player-mid": "",
  "player-related": "",
  "infeed-banner": "",
  "related-banner": "",
  "sticky-banner": "",
  "interstitial": ""
});

window.NEXUS_EXOCLICK_CONFIG = Object.freeze({
  enabled: false,
  scriptSrc: "https://a.magsrv.com/ad-provider.js",
  slots: Object.freeze({
    "player-top": Object.freeze({ zoneId: "", className: "eas6a97888e2" }),
    "player-mid": Object.freeze({ zoneId: "", className: "eas6a97888e2" }),
    "player-related": Object.freeze({ zoneId: "", className: "eas6a97888e2" }),
    "infeed-banner": Object.freeze({ zoneId: "", className: "eas6a97888e2" }),
    "related-banner": Object.freeze({ zoneId: "", className: "eas6a97888e2" }),
    "sticky-banner": Object.freeze({ zoneId: "", className: "eas6a97888e2" }),
    "interstitial": Object.freeze({ zoneId: "", className: "eas6a97888e2" })
  })
});
