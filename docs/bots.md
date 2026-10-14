# ZüriPoly – Computergegner

Wie die Bots entscheiden, warum sie fair spielen und warum jede Partie endet.
Code: `packages/engine/src/bot.ts` (Entscheide), `bot-eval.ts` (Bewertungen), `bot-trade.ts` (Handel).

## Grundidee

- Ein Bot ist eine **reine Funktion**: `chooseBotAction(state, playerId, rng, level?)` gibt für den Spieler, auf den das Spiel wartet, genau **eine Aktion** zurück.
- Ausgeführt wird die Aktion wie bei Menschen mit `applyAction`. Es gibt also keine Sonderregeln und keine Abkürzungen: Was die Engine einem Menschen verbietet, kann auch ein Bot nicht.
- Die Oberfläche (Phase 4) und später der Server (Phase 5) rufen die Funktion auf, warten kurz und schicken die Aktion ab.

## Fair spielen

- Ein Bot liest nur, was am Tisch alle sehen: Geld, Besitz, Häuser, Hypotheken, Positionen, Freikarten, die Stufe der anderen Bots und das Protokoll.
- Er liest **nie die Reihenfolge der Kartenstapel** und bekommt nie die Zufallsquelle des Spiels (Würfel). Ein Test prüft das: Wird nur die Kartenreihenfolge verändert, entscheidet der Bot gleich.
- Für seine eigenen Zufallsentscheide (Stufe «einfach») bekommt er eine **eigene** Zufallsquelle (`botRng`). So können Bots die Würfel nicht beeinflussen.
- Ein Handel wird «im Kopf» geprüft: Der Bot spielt ihn auf einer Kopie des Spielstands mit `applyAction` durch (ohne Würfel) und vergleicht vorher und nachher.

## Gedächtnis

Bots haben keinen versteckten Zustand. Was sie im laufenden Zug schon getan haben, lesen sie aus dem Protokoll (`state.log`, Ereignisse seit dem letzten «Zug beginnt»). Darum bleiben Spielstände speicherbar, und ein Bot kann jederzeit einspringen.

## Stufe «einfach»

Spielt wie jemand, der die Regeln kennt, aber nicht rechnet:
- kauft freie Felder mit etwa 80 % Wahrscheinlichkeit, wenn das Geld reicht (auch bis fast auf null; seit es keine Versteigerungen mehr gibt, kauft sie öfter);
- baut selten (etwa jede vierte Gelegenheit), löst Hypotheken selten aus; eine Baubewilligung setzt sie sofort auf einem zufälligen erlaubten Feld ein;
- entscheidet im Gefängnis zufällig zwischen Freikarte, Kaution und einen Zug aussetzen;
- verkauft bei Schulden Häuser oder belastet Felder in zufälliger Reihenfolge (oft ungeschickt);
- prüft Handelsangebote nur nach **Listenpreisen** und schätzt ungenau. Darum verkauft sie auch einmal die letzte Strasse einer fremden Farbgruppe, wenn genug Geld geboten wird;
- schlägt selten selbst einen Handel vor (Geld für die fehlenden Strassen einer eigenen Gruppe).

## Stufe «clever»

Bewertet die ganze Spielposition in Franken (`positionValue`):
- **Farbgruppen:** Eine ganze Gruppe zählt viel mehr als ihre Strassen (Mietpotenzial, umso mehr, je weiter ausgebaut). Mehrere Strassen derselben Gruppe geben einen kleinen Bonus.
- **Bahnhöfe und Versorger** zählen mehr, je mehr man davon hat.
- **Bargeld** zählt voll; unter der Geldreserve weniger (Risiko), für den Ausbau eigener Gruppen mehr (wird zu Miete).
- **Hypotheken** ziehen die Ablösung ab.

**Geldreserve** (`cashReserve`): 100 bis 500 CHF, je nachdem, wie hoch die teuerste Miete bei den Gegnern ist.

Entscheide:
- **Kaufen:** immer, wenn das Feld eine eigene Gruppe vollendet oder eine fremde blockiert, notfalls mit einer Hypothek auf ein Einzelfeld. Sonst nur, wenn die Reserve bleibt.
- **Bauen:** nur auf ganzen, unbelasteten Gruppen, gleichmässig, zuerst bis drei Häuser (bester Ertrag pro Franken). Für Häuser greift der Bot bis auf 30 % in die Reserve. Eine **Baubewilligung** setzt er sofort auf dem Feld mit dem besten Ertrag ein.
- **Hypotheken nur bei Bedarf:** bei Schulden oder um eine Gruppe zu vollenden. Auslösen, sobald genug Geld da ist, zuerst Felder aus ganzen Gruppen.
- **Schulden:** zuerst Einzelfelder belasten, dann Häuser verkaufen (wo am wenigsten Miete verloren geht), zuletzt Gruppenfelder. Bankrott nur, wenn die Engine ihn erlaubt (nichts reicht mehr).
- **Gefängnis:** früh im Spiel raus (Freikarte, Kaution), wenn Gegner gebaut haben, einen Zug sicher aussitzen.
- **Handel:** sucht Felder, die ihm eine Gruppe vollenden (oder näher bringen), und bietet Geld oder einen Tausch, bei dem der Partner ebenfalls eine Gruppe bekommt. Nimmt ein Angebot an, wenn es ihm etwas bringt und dem Partner nicht deutlich mehr. Im Zweikampf zahlt er kein Geld für Felder (der Gegner würde damit sofort bauen) und will klar mehr gewinnen als der Gegner.

## Schutz vor Endlosschleifen

- Höchstens **ein Handelsangebot pro Zug**; ein kürzlich abgelehntes Angebot (gleicher Partner, gleiche Felder) wird nicht wiederholt.
- Höchstens **15** (clever) bzw. **4** (einfach) Verwaltungsschritte pro Zug (bauen, verkaufen, belasten, auslösen). Danach nur noch würfeln, kaufen oder ablehnen, Zug beenden.
- Bei Schulden bringt jeder Schritt Geld, bis die Engine automatisch zahlt.

## Warum jede Partie endet

Zwei Fallen gibt es im Original auch:
1. **Niemand hat eine ganze Farbgruppe:** Ohne Häuser sind die Mieten klein, alle werden reicher. Darum handeln beide Stufen. Dauert eine Partie lange (ab etwa 40 Runden), werden die Bots schrittweise kompromissbereiter (`patience`).
2. **Häusermangel:** Die Bank hat keine Häuser mehr, niemand kommt zum Hotel. Dann baut ein Bot um wie ein echter Spieler: Häuser einer schwächeren Gruppe verkaufen und die stärkste Gruppe bis zum Hotel ausbauen. Jedes Hotel gibt vier Häuser an die Bank zurück.

## Prüfen

- `npm test`: Einzelfälle (`tests/bot.test.ts`), 100 gemischte Bot-Partien und 100 Zweikämpfe. Jede Aktion muss gültig sein, nach jeder Aktion gelten die Invarianten, jede Partie endet mit Gewinner, und «clever» gewinnt mindestens 70 % der Zweikämpfe gegen «einfach».
- `npm run bots -w @zueripoly/engine` (optional `-- --games 500 --check`): Tabelle mit Siegquoten je Paarung.

Ergebnis nach der Balance vom 2026-10-14 (neue Mieten, Pasch 1 von 7 und nur durchfahren, Baubewilligung; dazu die Regeln vom 2026-10-13: keine Versteigerungen, Gefängnis ein Zug, Steuern 100 / 50). 200 Partien je Paarung, mit Invariantenprüfung:

| Paarung | beendet | Siege clever | Siege einfach | Ø Züge | max. Züge |
|---|---|---|---|---|---|
| einfach gegen einfach | 200 | – | 100 % | 138 | 280 |
| clever gegen einfach | 200 | 84 % | 17 % | 142 | 273 |
| clever gegen clever | 200 | 100 % | – | 138 | 257 |
| 1 clever gegen 3 einfach | 200 | 70 % | 31 % | 185 | 567 |
| 2 clever gegen 2 einfach | 200 | 89 % | 12 % | 170 | 619 |
| 6 gemischt (3 + 3) | 200 | 96 % | 4 % | 212 | 562 |

Zum Vergleich: Nach den Regeln vom 2026-10-13 (alte Mieten) dauerte der Zweikampf Ø 141 Züge, in Phase 4 (mit Versteigerungen) 121.

### Balance-Versuche (2026-10-14)

Gemessen mit `npm run bots -w @zueripoly/engine -- --games 100`, Ø Züge im Zweikampf clever gegen einfach / 1 clever gegen 3 einfach:

| Variante | Zweikampf | 4 Spieler | Bemerkung |
|---|---|---|---|
| Nur höhere Grundmiete und 1. Haus | 153 | 204 | Pasch fährt nur durch, darum weniger Landungen pro Zug: länger als vorher |
| Häuser billiger Gruppen stärker (Braun +50 % … Dunkelblau ±0) | 137 | 192 | gewählt (als saubere Tabelle ohne Sprünge nach unten) |
| Häuser aller Gruppen noch stärker (+70 % … +20 %) | 134 | 170 | kaum kürzer, aber Hotels bis 2400 CHF: zu heftig |
| Nur 1. und 2. Haus stärker | 151 | 196 | bringt fast nichts: die Länge hängt an den Mieten mit 3+ Häusern |

Ohne Versteigerungen dauert es länger, bis jemand eine ganze Farbgruppe hat; das bestimmt die Spieldauer stärker als die Mietstaffel.

Bei gleich starken Bots würde «clever» als einer von vier nur in etwa 25 % der Partien gewinnen.
