# ZüriPoly – Das Brett

40 Felder, Index 0 bis 39, im Uhrzeigersinn. Start ist unten rechts (Feld 0), danach geht es nach links (Felder 1 bis 9), die linke Seite hinauf (11 bis 19), oben nach rechts (21 bis 29) und die rechte Seite hinunter (31 bis 39).
Alle Beträge in **CHF**, immer **runde Beträge** (durch 5 teilbar). Die Preise folgen dem Vorbild des Originals (60 bis 400). Die Mieten sind eigens ausbalanciert (2026-10-14, siehe Abschnitt 2). Die Zürcher Namen und Karten sind eigene Inhalte.

Zählkontrolle: 22 Strassen + 4 Bahnhöfe + 2 Versorger + 12 Spezialfelder = **40**.

## 1. Alle 40 Felder in Reihenfolge

| # | Feld | Art | Farbgruppe | Preis |
|---|---|---|---|---|
| 0 | **Start** | Start | | |
| 1 | Albisrieden | Strasse | Braun | 60 |
| 2 | Gemeindekarte | Gemeinde | | |
| 3 | Altstetten | Strasse | Braun | 60 |
| 4 | Staats- und Gemeindesteuer | Steuer | | zahle 100 |
| 5 | **Hauptbahnhof** | Bahnhof | | 200 |
| 6 | Seebach | Strasse | Hellblau | 100 |
| 7 | Ereigniskarte | Ereignis | | |
| 8 | Schwamendingen | Strasse | Hellblau | 100 |
| 9 | Affoltern | Strasse | Hellblau | 120 |
| 10 | **Gefängnis** (Besuch) | Gefängnis | | |
| 11 | Wiedikon | Strasse | Pink | 140 |
| 12 | **Stromnetz** | Versorger | | 150 |
| 13 | Wipkingen | Strasse | Pink | 140 |
| 14 | Höngg | Strasse | Pink | 160 |
| 15 | **Stadelhofen** | Bahnhof | | 200 |
| 16 | Letzigrund | Strasse | Orange | 180 |
| 17 | Gemeindekarte | Gemeinde | | |
| 18 | Langstrasse | Strasse | Orange | 180 |
| 19 | Zürich West | Strasse | Orange | 200 |
| 20 | **Ferien am Zürichsee** | Ferien | | |
| 21 | Niederdorf | Strasse | Rot | 220 |
| 22 | Ereigniskarte | Ereignis | | |
| 23 | Limmatquai | Strasse | Rot | 220 |
| 24 | Rennweg | Strasse | Rot | 240 |
| 25 | **Oerlikon** | Bahnhof | | 200 |
| 26 | Fluntern | Strasse | Gelb | 260 |
| 27 | Hottingen | Strasse | Gelb | 260 |
| 28 | **Seewasserwerk** | Versorger | | 150 |
| 29 | Hirslanden | Strasse | Gelb | 280 |
| 30 | **Gehe ins Gefängnis** | Gehe ins Gefängnis | | |
| 31 | Enge | Strasse | Grün | 300 |
| 32 | Seefeld | Strasse | Grün | 300 |
| 33 | Gemeindekarte | Gemeinde | | |
| 34 | Utoquai | Strasse | Grün | 320 |
| 35 | **Hardbrücke** | Bahnhof | | 200 |
| 36 | Ereigniskarte | Ereignis | | |
| 37 | Paradeplatz | Strasse | Dunkelblau | 350 |
| 38 | Serafe-Rechnung | Steuer | | zahle 50 |
| 39 | Bahnhofstrasse | Strasse | Dunkelblau | 400 |

Ecken: 0 Start (unten rechts), 10 Gefängnis (unten links), 20 Ferien am Zürichsee (oben links), 30 Gehe ins Gefängnis (oben rechts).

## 2. Strassen: Preise und Mieten

Gruppe = Miete bei kompletter Farbgruppe ohne Häuser (doppelte Grundmiete).
Hauspreis gilt für jedes Haus und für das Hotel (zusätzlich zu den 4 zurückgegebenen Häusern).
Hypothek = Auszahlung der Bank. Auslösen = Hypothek + 10 % Zins, aufgerundet auf 5 CHF (z. B. 30 → 35, 175 → 195).

**Balance (2026-10-14):** Die Grundmiete ist etwa 8–19 % des Preises (vorher 3–12 %), damit schon ohne Häuser spürbar Miete fliesst. Das erste Haus bringt mindestens das Dreifache der Grundmiete. Die Häuser der billigen Gruppen bringen mehr als im Original (Hotels etwa: Braun +50 %, Hellblau +35 %, Pink +30 %, Orange und Rot +25 %, Gelb +20 %, Grün +15 %, Dunkelblau 0–10 %). Eine teurere Strasse bringt auf keiner Stufe weniger Miete als eine billigere. Geprüft mit der Bot-Liga (`docs/bots.md`): Die Partien dauern trotz «Pasch fährt nur durch» etwa gleich lang wie vorher.

| # | Strasse | Gruppe | Preis | Miete | Gruppe | 1 H | 2 H | 3 H | 4 H | Hotel | Hauspreis | Hypothek |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Albisrieden | Braun | 60 | 5 | 10 | 25 | 45 | 140 | 240 | 380 | 50 | 30 |
| 3 | Altstetten | Braun | 60 | 10 | 20 | 45 | 90 | 270 | 480 | 700 | 50 | 30 |
| 6 | Seebach | Hellblau | 100 | 10 | 20 | 45 | 130 | 380 | 550 | 750 | 50 | 50 |
| 8 | Schwamendingen | Hellblau | 100 | 10 | 20 | 45 | 130 | 380 | 550 | 750 | 50 | 50 |
| 9 | Affoltern | Hellblau | 120 | 15 | 30 | 60 | 140 | 420 | 650 | 850 | 50 | 60 |
| 11 | Wiedikon | Pink | 140 | 15 | 30 | 65 | 200 | 600 | 800 | 1000 | 100 | 70 |
| 13 | Wipkingen | Pink | 140 | 15 | 30 | 65 | 200 | 600 | 800 | 1000 | 100 | 70 |
| 14 | Höngg | Pink | 160 | 20 | 40 | 80 | 230 | 650 | 900 | 1150 | 100 | 80 |
| 16 | Letzigrund | Orange | 180 | 20 | 40 | 90 | 250 | 700 | 950 | 1200 | 100 | 90 |
| 18 | Langstrasse | Orange | 180 | 20 | 40 | 90 | 250 | 700 | 950 | 1200 | 100 | 90 |
| 19 | Zürich West | Orange | 200 | 25 | 50 | 100 | 280 | 750 | 1000 | 1250 | 100 | 100 |
| 21 | Niederdorf | Rot | 220 | 25 | 50 | 110 | 300 | 850 | 1050 | 1300 | 150 | 110 |
| 23 | Limmatquai | Rot | 220 | 25 | 50 | 110 | 300 | 850 | 1050 | 1300 | 150 | 110 |
| 24 | Rennweg | Rot | 240 | 30 | 60 | 120 | 360 | 900 | 1100 | 1350 | 150 | 120 |
| 26 | Fluntern | Gelb | 260 | 35 | 70 | 130 | 380 | 950 | 1150 | 1400 | 150 | 130 |
| 27 | Hottingen | Gelb | 260 | 35 | 70 | 130 | 380 | 950 | 1150 | 1400 | 150 | 130 |
| 29 | Hirslanden | Gelb | 280 | 40 | 80 | 140 | 410 | 1000 | 1200 | 1450 | 150 | 140 |
| 31 | Enge | Grün | 300 | 45 | 90 | 150 | 430 | 1050 | 1250 | 1500 | 200 | 150 |
| 32 | Seefeld | Grün | 300 | 45 | 90 | 150 | 430 | 1050 | 1250 | 1500 | 200 | 150 |
| 34 | Utoquai | Grün | 320 | 50 | 100 | 170 | 500 | 1100 | 1300 | 1550 | 200 | 160 |
| 37 | Paradeplatz | Dunkelblau | 350 | 55 | 110 | 180 | 550 | 1200 | 1400 | 1650 | 200 | 175 |
| 39 | Bahnhofstrasse | Dunkelblau | 400 | 75 | 150 | 225 | 600 | 1400 | 1700 | 2000 | 200 | 200 |

Hauspreis je Farbgruppe: Braun und Hellblau 50, Pink und Orange 100, Rot und Gelb 150, Grün und Dunkelblau 200.
Farbgruppengrösse: Braun 2, Hellblau 3, Pink 3, Orange 3, Rot 3, Gelb 3, Grün 3, Dunkelblau 2.

## 3. Bahnhöfe
Preis 200, Hypothek 100, Auslösen 110.
Miete: **25** (1 Bahnhof) / **50** (2) / **100** (3) / **200** (4).

| # | Bahnhof |
|---|---|
| 5 | Hauptbahnhof |
| 15 | Stadelhofen |
| 25 | Oerlikon |
| 35 | Hardbrücke |

## 4. Versorger
Preis 150, Hypothek 75, Auslösen 85 (75 + 10 %, aufgerundet auf 5).
Miete: **5 ×** Augensumme (1 Versorger) / **10 ×** Augensumme (beide).

| # | Versorger |
|---|---|
| 12 | Stromnetz |
| 28 | Seewasserwerk |

## 5. Spezialfelder
| # | Feld | Wirkung |
|---|---|---|
| 0 | Start | +200 beim Vorbeiziehen oder Landen |
| 10 | Gefängnis (Besuch) | Nur Besuch, passiert nichts. Hier sitzen Gefangene. |
| 20 | Ferien am Zürichsee | Ohne Option: nichts. Mit Jackpot-Option: Topf kassieren. |
| 30 | Gehe ins Gefängnis | Direkt auf Feld 10, ohne Start-Geld, Zug endet. |
| 4 | Staats- und Gemeindesteuer | Zahle 100 |
| 38 | Serafe-Rechnung | Zahle 50 |
| 7, 22, 36 | Ereigniskarte | Ereignisstapel |
| 2, 17, 33 | Gemeindekarte | Gemeindestapel |

## 6. Ereigniskarten (16)

Stapel «Ereignis»: Bewegung, Bussen und kleine Zwischenfälle aus dem Zürcher Alltag.
Effektcodes sind für die Engine gedacht; umgesetzt in `packages/engine/src/cards.ts`.

| ID | Text | Effekt |
|---|---|---|
| E01 | Sechseläuten! Der Böögg brennt, du eilst zur Feier: Rücke vor auf Start und ziehe 200 CHF ein. | `moveTo:0`, Start-Bonus |
| E02 | Street Parade: Du tanzt dich bis zum Utoquai. Kommst du an Start vorbei, ziehst du 200 CHF ein. | `moveTo:34`, Start-Bonus bei Überquerung |
| E03 | Züri Fäscht: Du ergatterst den besten Platz an der Bahnhofstrasse. Rücke vor. Kommst du an Start vorbei, ziehst du 200 CHF ein. | `moveTo:39`, Start-Bonus bei Überquerung |
| E04 | Der Strom fällt aus: Rücke vor zum nächsten Versorger. Gehört er niemandem, darfst du ihn kaufen. Sonst würfle und zahle dem Besitzer das 10-Fache der Augensumme. | `moveToNearest:utility`, Miete ×10 |
| E05 | Tram verpasst: Fahre zum nächsten Bahnhof. Gehört er jemandem, zahle die doppelte Miete. Sonst darfst du ihn kaufen. | `moveToNearest:station`, Miete ×2 |
| E06 | Das Amt für Baubewilligungen ist ausnahmsweise schnell: Baue gratis ein Haus oder ein Hotel auf einer deiner Strassen. Behalte die Karte, bis du sie brauchst. | `buildPermit` (behalten, nicht handelbar; normale Bauregeln, nur ohne Geld) |
| E07 | Die Bank zahlt dir eine Dividende: Ziehe 50 CHF ein. | `gain:50` |
| E08 | Dein Götti kennt den Stadtrat: Du darfst die Karte «Aus dem Gefängnis frei» behalten, bis du sie brauchst. | `getOutOfJailFree` |
| E09 | Uetliberg-Wanderung: Du hast dich verlaufen. Gehe 3 Felder zurück. | `moveBy:-3` |
| E10 | Falschparkiert und frech geworden: Gehe direkt ins Gefängnis, nicht über Start, ziehe keine 200 CHF ein. | `goToJail` |
| E11 | Der Hauswart schickt die Rechnung: 25 CHF pro Haus, 100 CHF pro Hotel. | `repairs:25:100` |
| E12 | Mit dem 4er ohne Billett erwischt: Zahle 15 CHF Busse. | `pay:15` |
| E13 | Böögg-Wette verloren: Der Sommer wird nass. Zahle jedem Mitspieler 50 CHF. | `payEach:50` |
| E14 | Deine Genossenschaft zahlt dir den Baukredit aus: Ziehe 150 CHF ein. | `gain:150` |
| E15 | Du gewinnst die Quartier-Tombola: Ziehe 100 CHF ein. | `gain:100` |
| E16 | Ausflug an den Hauptbahnhof: Rücke vor zum Hauptbahnhof. Kommst du an Start vorbei, ziehst du 200 CHF ein. | `moveTo:5`, Start-Bonus bei Überquerung |

## 7. Gemeindekarten (16)

Stapel «Gemeinde»: Behörden, Familie, Quartier und Geld.

| ID | Text | Effekt |
|---|---|---|
| G01 | Neujahrsapéro im Quartier: Rücke vor auf Start und ziehe 200 CHF ein. | `moveTo:0`, Start-Bonus |
| G02 | Die Bank hat sich verrechnet, zu deinen Gunsten: Ziehe 200 CHF ein. | `gain:200` |
| G03 | Zahnarztrechnung: Zahle 50 CHF. | `pay:50` |
| G04 | Du verkaufst dein altes Velo auf dem Flohmarkt: Ziehe 50 CHF ein. | `gain:50` |
| G05 | Die Nachbarin kennt die Polizei: Du darfst die Karte «Aus dem Gefängnis frei» behalten, bis du sie brauchst. | `getOutOfJailFree` |
| G06 | Nachtruhe verletzt, Fondue-Party bis 3 Uhr: Gehe direkt ins Gefängnis, nicht über Start, ziehe keine 200 CHF ein. | `goToJail` |
| G07 | Die Quartierfeier war ein Hit: Jeder Mitspieler zahlt dir 50 CHF. | `collectEach:50` |
| G08 | 13. Monatslohn: Ziehe 100 CHF ein. | `gain:100` |
| G09 | Steuerrückerstattung: Ziehe 20 CHF ein. | `gain:20` |
| G10 | Du hast Geburtstag: Jeder Mitspieler zahlt dir 10 CHF. | `collectEach:10` |
| G11 | Deine Lebensversicherung wird fällig: Ziehe 100 CHF ein. | `gain:100` |
| G12 | Spitalrechnung: Zahle 100 CHF. | `pay:100` |
| G13 | Klassenlager deiner Kinder: Zahle 50 CHF. | `pay:50` |
| G14 | Beratungshonorar für einen Auftrag: Ziehe 25 CHF ein. | `gain:25` |
| G15 | Das Strassenbauamt saniert: 40 CHF pro Haus, 115 CHF pro Hotel. | `repairs:40:115` |
| G16 | Zweiter Platz beim Fondue-Wettessen: Ziehe 10 CHF ein. | `gain:10` |

Zählkontrolle: 16 + 16 Karten. Genau eine Freikarte je Stapel (E08, G05), eine Baubewilligung (E06, ersetzt seit 2026-10-14 die zweite «Tram verpasst»-Karte).

## 8. Figuren
Tram, Schwan, Böögg, Fondue-Caquelon, Velo, Kaffeebecher (6 Stück, siehe [design.md](design.md)).
