# ZüriPoly – Das Brett

40 Felder, Index 0 bis 39, im Uhrzeigersinn. Start ist unten rechts (Feld 0), danach geht es nach links (Felder 1 bis 9), die linke Seite hinauf (11 bis 19), oben nach rechts (21 bis 29) und die rechte Seite hinunter (31 bis 39).
Alle Beträge in **CHF**, immer **runde Beträge** (durch 5 teilbar). Die Preise liegen leicht über dem Vorbild des Originals (70 bis 400). Preise, Hauspreise und Mieten sind eigens ausbalanciert (2026-10-20, siehe Abschnitt 2). Die Zürcher Namen und Karten sind eigene Inhalte.

Zählkontrolle: 22 Strassen + 4 Bahnhöfe + 2 Versorger + 12 Spezialfelder = **40**.

## 1. Alle 40 Felder in Reihenfolge

| # | Feld | Art | Farbgruppe | Preis |
|---|---|---|---|---|
| 0 | **Start** | Start | | |
| 1 | Albisrieden | Strasse | Braun | 70 |
| 2 | Gemeindekarte | Gemeinde | | |
| 3 | Altstetten | Strasse | Braun | 80 |
| 4 | Staats- und Gemeindesteuer | Steuer | | zahle 100 |
| 5 | **Hauptbahnhof** | Bahnhof | | 200 |
| 6 | Seebach | Strasse | Hellblau | 110 |
| 7 | Ereigniskarte | Ereignis | | |
| 8 | Schwamendingen | Strasse | Hellblau | 110 |
| 9 | Affoltern | Strasse | Hellblau | 130 |
| 10 | **Gefängnis** (Besuch) | Gefängnis | | |
| 11 | Wiedikon | Strasse | Pink | 150 |
| 12 | **Stromnetz** | Versorger | | 150 |
| 13 | Wipkingen | Strasse | Pink | 150 |
| 14 | Höngg | Strasse | Pink | 170 |
| 15 | **Stadelhofen** | Bahnhof | | 200 |
| 16 | Letzigrund | Strasse | Orange | 190 |
| 17 | Gemeindekarte | Gemeinde | | |
| 18 | Langstrasse | Strasse | Orange | 190 |
| 19 | Zürich West | Strasse | Orange | 210 |
| 20 | **Ferien am Zürichsee** | Ferien | | |
| 21 | Niederdorf | Strasse | Rot | 230 |
| 22 | Ereigniskarte | Ereignis | | |
| 23 | Limmatquai | Strasse | Rot | 230 |
| 24 | Rennweg | Strasse | Rot | 250 |
| 25 | **Oerlikon** | Bahnhof | | 200 |
| 26 | Fluntern | Strasse | Gelb | 270 |
| 27 | Hottingen | Strasse | Gelb | 270 |
| 28 | **Seewasserwerk** | Versorger | | 150 |
| 29 | Hirslanden | Strasse | Gelb | 290 |
| 30 | **Gehe ins Gefängnis** | Gehe ins Gefängnis | | |
| 31 | Enge | Strasse | Grün | 310 |
| 32 | Seefeld | Strasse | Grün | 310 |
| 33 | Gemeindekarte | Gemeinde | | |
| 34 | Utoquai | Strasse | Grün | 330 |
| 35 | **Hardbrücke** | Bahnhof | | 200 |
| 36 | Ereigniskarte | Ereignis | | |
| 37 | Paradeplatz | Strasse | Dunkelblau | 360 |
| 38 | Serafe-Rechnung | Steuer | | zahle 50 |
| 39 | Bahnhofstrasse | Strasse | Dunkelblau | 400 |

Ecken: 0 Start (unten rechts), 10 Gefängnis (unten links), 20 Ferien am Zürichsee (oben links), 30 Gehe ins Gefängnis (oben rechts).

## 2. Strassen: Preise und Mieten

Gruppe = Miete bei kompletter Farbgruppe ohne Häuser (doppelte Grundmiete).
Hauspreis gilt für jedes Haus und für das Hotel (zusätzlich zu den 4 zurückgegebenen Häusern).
Hypothek = Auszahlung der Bank. Auslösen = Hypothek + 10 % Zins, aufgerundet auf 5 CHF (z. B. 35 → 40, 180 → 200).

**Balance (2026-10-20, Wunsch des Entwicklers):** Am Anfang soll spürbar Miete fliessen, mit vielen Häusern soll ein Besuch weh tun, aber selten das sofortige Aus bedeuten.
- Grundmiete mindestens 15 % des Preises (etwa 18 %, vorher 8–19 %), mit ganzer Farbgruppe doppelt.
- Häuser-Mieten nach einer Formel statt von Hand: Miete = Faktor × 400 × (Preis / 400)^0,55, Faktoren 0,6 / 1,3 / 2,25 / 2,8 / 3,25 für 1–4 Häuser und Hotel, gerundet auf 5. Der Exponent unter 1 macht billige Strassen verhältnismässig stärker, ohne dass eine teurere Strasse je weniger bringt.
- Obergrenzen: 3 Häuser höchstens 900 CHF (Bahnhofstrasse), Hotel höchstens 1300 CHF (vorher 1400 und 2000).
- Preise leicht höher (meist +10 CHF), Häuser etwa +10 % teurer (60 / 110 / 160 / 220).
- Das erste Haus bringt mindestens das Dreifache der Grundmiete. `board.test.ts` prüft alle diese Regeln.
- Geprüft mit `npm run balance` und der Bot-Liga (`docs/bots.md`): Partien dauern etwa 18 % länger als vorher, alle enden.

| # | Strasse | Gruppe | Preis | Miete | Gruppe | 1 H | 2 H | 3 H | 4 H | Hotel | Hauspreis | Hypothek |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Albisrieden | Braun | 70 | 15 | 30 | 90 | 200 | 345 | 430 | 500 | 60 | 35 |
| 3 | Altstetten | Braun | 80 | 15 | 30 | 100 | 215 | 370 | 460 | 535 | 60 | 40 |
| 6 | Seebach | Hellblau | 110 | 20 | 40 | 120 | 255 | 440 | 550 | 640 | 60 | 55 |
| 8 | Schwamendingen | Hellblau | 110 | 20 | 40 | 120 | 255 | 440 | 550 | 640 | 60 | 55 |
| 9 | Affoltern | Hellblau | 130 | 25 | 50 | 130 | 280 | 485 | 605 | 700 | 60 | 65 |
| 11 | Wiedikon | Pink | 150 | 25 | 50 | 140 | 305 | 525 | 655 | 760 | 110 | 75 |
| 13 | Wipkingen | Pink | 150 | 25 | 50 | 140 | 305 | 525 | 655 | 760 | 110 | 75 |
| 14 | Höngg | Pink | 170 | 30 | 60 | 150 | 325 | 560 | 700 | 810 | 110 | 85 |
| 16 | Letzigrund | Orange | 190 | 35 | 70 | 160 | 345 | 600 | 745 | 865 | 110 | 95 |
| 18 | Langstrasse | Orange | 190 | 35 | 70 | 160 | 345 | 600 | 745 | 865 | 110 | 95 |
| 19 | Zürich West | Orange | 210 | 40 | 80 | 170 | 365 | 630 | 785 | 910 | 110 | 105 |
| 21 | Niederdorf | Rot | 230 | 40 | 80 | 175 | 385 | 665 | 825 | 960 | 160 | 115 |
| 23 | Limmatquai | Rot | 230 | 40 | 80 | 175 | 385 | 665 | 825 | 960 | 160 | 115 |
| 24 | Rennweg | Rot | 250 | 45 | 90 | 185 | 400 | 695 | 865 | 1005 | 160 | 125 |
| 26 | Fluntern | Gelb | 270 | 50 | 100 | 195 | 420 | 725 | 900 | 1045 | 160 | 135 |
| 27 | Hottingen | Gelb | 270 | 50 | 100 | 195 | 420 | 725 | 900 | 1045 | 160 | 135 |
| 29 | Hirslanden | Gelb | 290 | 50 | 100 | 200 | 435 | 755 | 940 | 1090 | 160 | 145 |
| 31 | Enge | Grün | 310 | 55 | 110 | 210 | 450 | 780 | 975 | 1130 | 220 | 155 |
| 32 | Seefeld | Grün | 310 | 55 | 110 | 210 | 450 | 780 | 975 | 1130 | 220 | 155 |
| 34 | Utoquai | Grün | 330 | 60 | 120 | 215 | 470 | 810 | 1010 | 1170 | 220 | 165 |
| 37 | Paradeplatz | Dunkelblau | 360 | 65 | 130 | 225 | 490 | 850 | 1055 | 1225 | 220 | 180 |
| 39 | Bahnhofstrasse | Dunkelblau | 400 | 75 | 150 | 240 | 520 | 900 | 1120 | 1300 | 220 | 200 |

Hauspreis je Farbgruppe: Braun und Hellblau 60, Pink und Orange 110, Rot und Gelb 160, Grün und Dunkelblau 220.
Farbgruppengrösse: Braun 2, Hellblau 3, Pink 3, Orange 3, Rot 3, Gelb 3, Grün 3, Dunkelblau 2.

## 3. Bahnhöfe
Preis 200, Hypothek 100, Auslösen 110.
Miete: **30** (1 Bahnhof) / **60** (2) / **110** (3) / **170** (4).

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
| E11 | Der Hauswart schickt die Rechnung: 30 CHF pro Haus, 120 CHF pro Hotel. | `repairs:30:120` |
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
| G15 | Das Strassenbauamt saniert: 40 CHF pro Haus, 160 CHF pro Hotel. | `repairs:40:160` |
| G16 | Zweiter Platz beim Fondue-Wettessen: Ziehe 10 CHF ein. | `gain:10` |

Zählkontrolle: 16 + 16 Karten. Genau eine Freikarte je Stapel (E08, G05), eine Baubewilligung (E06, ersetzt seit 2026-10-14 die zweite «Tram verpasst»-Karte).

## 8. Figuren
Tram, Schwan, Böögg, Fondue-Caquelon, Velo, Kaffeebecher (6 Stück, siehe [design.md](design.md)).
