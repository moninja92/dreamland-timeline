// Everything a non-programmer might need to change lives in this file.

export const CONFIG = {
  /**
   * Where the timeline data comes from. Any CSV URL works.
   * Recommended: in Google Sheets, File > Share > Publish to web > "timelineread" > CSV,
   * then paste that link here. The gviz link below works today because the sheet is link-shared.
   */
  sheetCsvUrl:
    "https://docs.google.com/spreadsheets/d/19NZZGrcnWRcVd95kszYeEPNwpck0bjC1vcTXmVOHsLM/gviz/tq?tqx=out:csv&sheet=timelineread",

  /** Bundled copy used when the sheet can't be reached (offline, Google hiccup). */
  fallbackCsvPath: "timeline-snapshot.csv",

  /** Obsidian vault name for obsidian:// links. Leave empty to hide them. */
  obsidianVault: "Dreamland",

  /**
   * Base URL of a published copy of the bible (Quartz, Obsidian Publish, etc).
   * A note named "Kazrik Lancer" links to `${bibleBaseUrl}/kazrik-lancer`. Leave empty to hide.
   */
  bibleBaseUrl: "",

  /** Event selected on first load on desktop when the URL has no #event-id. */
  defaultEventId: "roswell-crash",

  /**
   * Category "stamp ink" colors. Each maps to a CSS token in src/style.css, which holds
   * the dark and light values. Unknown categories use the Manila accent.
   */
  categoryColors: {
    Character: "--cat-char",
    War: "--cat-war",
    Corporate: "--cat-corp",
    Governance: "--cat-gov",
    Social: "--cat-social",
    "Alien Event": "--cat-alien",
    International: "--cat-intl",
    Technological: "--cat-tech",
    Game: "--cat-game",
  } as Record<string, string>,
};
