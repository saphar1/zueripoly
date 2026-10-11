// Zahlen und Texte für die Anzeige (de-CH).

const CHF = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });

/** 1500 → «1’500 CHF» (Schweizer Tausendertrennzeichen). */
export function formatChf(amount: number): string {
  return `${CHF.format(amount)} CHF`;
}

/** Nur die Zahl, ohne Währung: 1500 → «1’500». */
export function formatNumber(amount: number): string {
  return CHF.format(amount);
}

/**
 * Feldnamen mit weichen Trennstellen (U+00AD), damit lange Namen auf schmalen Feldern
 * sauber umbrechen. Der Browser trennt nur, wenn es nötig ist.
 */
const SOFT_HYPHENS: Record<string, string> = {
  Albisrieden: "Albis­rieden",
  Altstetten: "Alt­stetten",
  "Staats- und Gemeindesteuer": "Staats- und Gemeinde­steuer",
  Hauptbahnhof: "Haupt­bahnhof",
  Schwamendingen: "Schwamen­dingen",
  Affoltern: "Affol­tern",
  Wiedikon: "Wiedi­kon",
  Stromnetz: "Strom­netz",
  Wipkingen: "Wip­kingen",
  Stadelhofen: "Stadel­hofen",
  Letzigrund: "Letzi­grund",
  Langstrasse: "Lang­strasse",
  Niederdorf: "Nieder­dorf",
  Limmatquai: "Limmat­quai",
  Oerlikon: "Oerli­kon",
  Hottingen: "Hottin­gen",
  Seewasserwerk: "Seewasser­werk",
  Hirslanden: "Hirs­landen",
  Hardbrücke: "Hard­brücke",
  Paradeplatz: "Parade­platz",
  "Serafe-Rechnung": "Serafe-Rechnung",
  Bahnhofstrasse: "Bahnhof­strasse",
  Gemeindekarte: "Gemeinde­karte",
  Ereigniskarte: "Ereignis­karte",
};

export function hyphenate(name: string): string {
  return SOFT_HYPHENS[name] ?? name;
}
