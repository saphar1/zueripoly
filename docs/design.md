# ZüriPoly – Designkonzept

Verbindlich für alle Oberflächen (Phase 3 und später). Entwurf wird vor dem Bau von echten Bildschirmen als statisches HTML gezeigt und freigegeben.

## 1. Gestaltungsidee
**«Haltestelle trifft Brettspiel.»** Internationaler Typografischer Stil (Raster, grosse Flächen, klare Hierarchie, linksbündig) gemischt mit der Zürcher Verkehrs- und Beschilderungsästhetik: Haltestellenanzeigen, Fahrpläne, Liniennummern, Perrontafeln.
- Information steht wie auf einer Fahrplantafel: Zeilen, Spalten, Linien, Nummern in Kreisen.
- Farbe trägt Bedeutung (Farbgruppen, Spieler), nicht Dekoration.
- Haptik eines gedruckten Brettspiels: Papier, klare Ränder, Druckversatz statt Weichschatten.
- Das Logo ist reine Typografie: «ZüriPoly» in Bricolage Grotesque, mit einem Liniennummern-Kreis (wie ein Tramkreis) als Zeichen.

## 2. Farbpalette
Wenige Farben, konsequent eingesetzt.

| Token | Hex | Verwendung |
|---|---|---|
| `--color-paper` | `#F5F2EA` | Alpenweiss: Hintergrund, Karten |
| `--color-paper-dark` | `#E9E4D6` | Vertiefte Flächen, Rillen |
| `--color-ink` | `#12161C` | Text, Linien, Druckversatz |
| `--color-lake` | `#1F7FB8` | Zürichsee-Blau: Brettmitte, Wasser, Hervorhebungen |
| `--color-tram` | `#0B4FA8` | Tram-Blau: Hauptaktionen, Kopfzeilen |
| `--color-signal` | `#D8312B` | Signalrot: Warnung, Schulden, «Gehe ins Gefängnis» |

Farbgruppen (Balken auf dem Brett, Besitzkarten):

| Token | Gruppe | Hex |
|---|---|---|
| `--group-brown` | Braun | `#7A4A2B` |
| `--group-lightblue` | Hellblau | `#8FCDEB` |
| `--group-pink` | Pink | `#E0709F` |
| `--group-orange` | Orange | `#EE8A2A` |
| `--group-red` | Rot | `#D8312B` |
| `--group-yellow` | Gelb | `#F2C418` |
| `--group-green` | Grün | `#2F9E5B` |
| `--group-navy` | Dunkelblau | `#1B2559` |
| `--group-station` | Bahnhöfe | `#12161C` (Tinte) |
| `--group-utility` | Versorger | `#8A8F98` |

Spielerfarben (je Figur, mindestens 3:1 Kontrast gegen Papier): Tram `#0B4FA8`, Schwan `#12161C`, Böögg `#D8312B`, Caquelon `#EE8A2A`, Velo `#2F9E5B`, Kaffeebecher `#7A4A2B`.
Text auf Farbflächen immer prüfen (AA, 4.5:1); auf Gelb, Hellblau, Orange dunkle Tinte, sonst Papier.

## 3. Schriften
Lokal eingebunden (woff2, Pakete `@fontsource-variable/*`, Lizenz SIL OFL). Keine externen Aufrufe.

| Rolle | Schrift | Warum |
|---|---|---|
| Überschriften, Zahlen, Feldnamen | **Bricolage Grotesque** (variabel, Gewicht 200–800, Breite 75–100) | Markant, mit leicht eigenwilligen Formen; die schmalen, fetten Schnitte lesen sich wie Beschilderung und sind auf kleinen Feldern gut lesbar. |
| Fliesstext, Protokoll, Bedienelemente | **Familjen Grotesk** (variabel, Gewicht 400–700) | Ruhige, gut lesbare Grotesk mit Charakter; ergänzt Bricolage, ohne zu konkurrieren. |

Regeln:
- Überschriften in Bricolage, **Gewicht 700–800**, Titel gerne eng gesetzt (Zeichenabstand leicht negativ).
- Zahlen (Preise, Kontostand) mit `font-variant-numeric: tabular-nums`.
- Zeilenlänge Text 45–70 Zeichen. Keine Blocksatz, keine Versalien-Dauerschrift.
- Zahlen mit Schweizer Tausendertrennzeichen **’** (zum Beispiel 1’500 CHF) per `Intl.NumberFormat('de-CH')`.

## 4. Raster und Abstände
- **8-Pixel-Grundraster**, Abstände nur aus der Skala: 4, 8, 12, 16, 24, 32, 48, 64.
- Desktop: 12-Spalten-Raster; Brett links gross, rechts schmale Spalte mit Spielerpanels, Protokoll, Aktionen. Handy: ein Spalte, Brett oben mit Zoom, Panels als Tafeln darunter.
- Linien: **2 px Tinte** für Ränder und Trennlinien, 1 px für feine Gliederung.
- Eckenradius: **0**. Ausnahme: Kreise (Liniennummern, Spielerfarben, Würfelaugen).
- Schatten: nur **harter Druckversatz** (`box-shadow: 4px 4px 0 var(--color-ink)`), nie unscharf.

## 5. Haptik und Bewegung
- Leichte Papierstruktur als Hintergrund: ein kleines, selbst erzeugtes SVG-Rauschmuster (feTurbulence) bei sehr geringer Deckkraft.
- Karten haben klare 2-px-Ränder und leichten Versatz, wie gestanzte Kartonkarten.
- **Bewegung mit Sinn:** Würfel rollen (0,6 s), Figur hüpft Feld für Feld (0,15 s je Feld), Karte dreht sich um (0,5 s), Geld «fliesst» als Zahl, die hoch- oder runterzählt (0,6 s). **Keine Dauer-Animationen** aus reiner Dekoration.
- `prefers-reduced-motion`: Alle Bewegungen werden zu kurzen Übergängen (Sprung statt Flug, Einblenden statt Drehen).
- Ton: kurze, dezente Geräusche (Würfel, Kauf, Geld, Karte). Stummschalter immer sichtbar, Standard: **an**, Lautstärke gering. Wird zu Beginn nicht automatisch abgespielt (Browser erlaubt Ton erst nach Klick).

## 6. Komponentenliste
1. **Brett** (`Board`): 11×11-Raster, vier Seiten mit Feldern, vier Ecken; Zoom (Pinch, Rad, Tasten +/−) und Verschieben auf dem Handy.
2. **Feld** (`Tile`): Farbbalken oben (Seite zum Inneren), gedrehter Name an den Seiten, Preis unten, Eigentümerzeichen (Spielerkreis).
3. **Eckfeld** (`CornerTile`): Start, Gefängnis, Ferien, Gehe ins Gefängnis.
4. **Mitte** (`BoardCenter`): Logo, Zürichsee-Fläche, Würfelbereich, Kartenstapel.
5. **Figur** (`Token`): sechs SVG-Figuren mit einheitlicher 3-px-Linie.
6. **Würfel** (`Dice`): SVG, Augen als Kreise, Rollanimation.
7. **Spielerpanel** (`PlayerPanel`): Name, Figur, Kontostand, Besitz als Farbstreifen, Zustand (am Zug, Gefängnis, bankrott).
8. **Besitzkarte** (`DeedCard`): wie echte Titelkarte: Farbbalken, Miete-Tabelle, Hauspreis, Hypothek.
9. **Ereignis-/Gemeindekarte** (`EventCard`): Rückseite mit Linienmuster, Vorderseite mit Text; Umdrehanimation.
10. **Aktionsleiste** (`ActionBar`): Würfeln, Kaufen, Bauen, Handeln, Zug beenden; ein Hauptknopf in Tram-Blau.
11. **Auktion** (`AuctionDialog`): Gebotsfeld, aktueller Höchstbietender.
12. **Handel** (`TradeDialog`): zwei Spalten (Gib/Bekomme).
13. **Spielprotokoll** (`GameLog`): Fahrplan-ähnliche Zeilenliste mit Zeitmarke und witzigem Text.
14. **Lobby** (`Lobby`): Namen, Figurenwahl, Optionen (Jackpot, Zeitlimit, Startkapital), Raumcode.
15. **Hauptmenü** (`MainMenu`): Solo, Lokal, Online, Spielstand fortsetzen.
16. **Tafeln** (`Sign`): Meldungen im Stil einer Haltestellenanzeige (z. B. «Nächster Halt: Gefängnis»).
17. **Icons** (`Icon`): Hausbau, Hotel, Hypothek, Würfel, Ton, Zoom – eigene SVG, 2-px-Linie.

## 7. Figuren (SVG, selbst gebaut)
Alle in 64×64-Zeichenfläche, **Linienstärke 3 px**, runde Linienenden, flache Füllung in Spielerfarbe, Details in Tinte.
| Figur | Idee |
|---|---|
| Tram | Seitenansicht, Fensterreihe, Stromabnehmer |
| Schwan | Hals als weicher S-Bogen, auf dem See |
| Böögg | Schneemann mit Zylinder und Besen, Funkenzeichen |
| Fondue-Caquelon | Topf mit Henkel und Gabel |
| Velo | Zwei Kreise, Rahmen, Lenker |
| Kaffeebecher | Becher mit Dampfkringel |

## 8. Spielprotokoll: Stimme
Kurz, trocken, mit Zürcher Witz, immer Deutsch in Schweizer Schreibweise («ss»). Beispiele:
- «Anna kauft die Langstrasse.»
- «Ben würfelt 8 und landet am Paradeplatz. Das wird teuer.»
- «Clara verpasst das Tram und zahlt 15 CHF Busse.»
- «Dario geht ins Gefängnis. Direkt dorthin, ohne Start.»

## 9. Design Tokens (CSS-Variablen)
Dieser Block wird in Phase 3 nach `packages/client/src/styles/tokens.css` kopiert. Änderungen immer zuerst hier.

```css
:root {
  /* Farben */
  --color-paper: #F5F2EA;
  --color-paper-dark: #E9E4D6;
  --color-ink: #12161C;
  --color-lake: #1F7FB8;
  --color-tram: #0B4FA8;
  --color-signal: #D8312B;

  /* Farbgruppen */
  --group-brown: #7A4A2B;
  --group-lightblue: #8FCDEB;
  --group-pink: #E0709F;
  --group-orange: #EE8A2A;
  --group-red: #D8312B;
  --group-yellow: #F2C418;
  --group-green: #2F9E5B;
  --group-navy: #1B2559;
  --group-station: #12161C;
  --group-utility: #8A8F98;

  /* Schriften */
  --font-display: "Bricolage Grotesque Variable", "Bricolage Grotesque", sans-serif;
  --font-text: "Familjen Grotesk Variable", "Familjen Grotesk", sans-serif;

  /* Abstände (8-px-Raster) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  /* Linien, Ecken, Druckversatz */
  --line-thick: 2px;
  --line-thin: 1px;
  --radius: 0;
  --offset: 4px 4px 0 var(--color-ink);
  --offset-small: 2px 2px 0 var(--color-ink);

  /* Bewegung */
  --motion-dice: 600ms;
  --motion-step: 150ms;
  --motion-card: 500ms;
  --motion-count: 600ms;
  --ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-dice: 1ms;
    --motion-step: 1ms;
    --motion-card: 1ms;
    --motion-count: 1ms;
  }
}
```

## 10. Drei Dinge, die wir bewusst nicht tun
1. **Keine Dekoration ohne Funktion.** Jede Linie, Fläche und Farbe trägt Information (Gruppe, Besitz, Zustand). Kein Hintergrundmuster zum Füllen, keine Sterne, keine Konfetti-Dauerschleife.
2. **Keine fertigen Pop-ups und Systemdialoge.** Entscheidungen erscheinen als Tafel im Stil einer Haltestellenanzeige direkt neben dem Brett, nicht als graues Overlay mit runder Karte.
3. **Keine fremden Bilder oder Icon-Sets.** Alles Grafische (Figuren, Würfel, Gebäude, Icons) ist selbst gezeichnet, mit gleicher Linienstärke. Keine Stockfotos, keine Emojis als Symbole.

## 11. Prüfung vor Abgabe (Checkliste)
- Desktop (1440×900) und Handy (390×844) als Screenshot gegen dieses Dokument geprüft.
- Nur Schriften aus Abschnitt 3 sichtbar; kein Systemfont-Fallback bemerkbar.
- Alle Farben aus Tokens; kein Wert hartkodiert.
- Kontrast Text/Fläche AA.
- `prefers-reduced-motion` getestet.
- Keine Verläufe, kein Glow, keine Weichschatten, keine Emojis.
- Kein «ß» in irgendeinem Text.
