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
- kauft freie Felder mit etwa 65 % Wahrscheinlichkeit, wenn das Geld reicht (auch bis fast auf null);
- bietet in Versteigerungen zufällig bis 40–100 % des Listenpreises und steigt zufällig aus;
- baut selten (etwa jede vierte Gelegenheit), löst Hypotheken selten aus;
- entscheidet im Gefängnis zufällig zwischen Freikarte, Kaution und Würfeln;
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
- **Versteigern:** bietet bis zum eigenen Wert des Feldes, in Sprüngen von etwa 10 % des Preises.
- **Bauen:** nur auf ganzen, unbelasteten Gruppen, gleichmässig, zuerst bis drei Häuser (bester Ertrag pro Franken). Für Häuser greift der Bot bis auf 30 % in die Reserve.
- **Hypotheken nur bei Bedarf:** bei Schulden oder um eine Gruppe zu vollenden. Auslösen, sobald genug Geld da ist, zuerst Felder aus ganzen Gruppen.
- **Schulden:** zuerst Einzelfelder belasten, dann Häuser verkaufen (wo am wenigsten Miete verloren geht), zuletzt Gruppenfelder. Bankrott nur, wenn die Engine ihn erlaubt (nichts reicht mehr).
- **Gefängnis:** früh im Spiel raus (Freikarte, Kaution), wenn Gegner gebaut haben, sicher sitzen bleiben.
- **Handel:** sucht Felder, die ihm eine Gruppe vollenden (oder näher bringen), und bietet Geld oder einen Tausch, bei dem der Partner ebenfalls eine Gruppe bekommt. Nimmt ein Angebot an, wenn es ihm etwas bringt und dem Partner nicht deutlich mehr. Im Zweikampf zahlt er kein Geld für Felder (der Gegner würde damit sofort bauen) und will klar mehr gewinnen als der Gegner.

## Schutz vor Endlosschleifen

- Höchstens **ein Handelsangebot pro Zug**; ein kürzlich abgelehntes Angebot (gleicher Partner, gleiche Felder) wird nicht wiederholt.
- Höchstens **15** (clever) bzw. **4** (einfach) Verwaltungsschritte pro Zug (bauen, verkaufen, belasten, auslösen). Danach nur noch würfeln, kaufen oder ablehnen, Zug beenden.
- Gebote steigen immer, also endet jede Versteigerung. Bei Schulden bringt jeder Schritt Geld, bis die Engine automatisch zahlt.

## Warum jede Partie endet

Zwei Fallen gibt es im Original auch:
1. **Niemand hat eine ganze Farbgruppe:** Ohne Häuser sind die Mieten klein, alle werden reicher. Darum handeln beide Stufen. Dauert eine Partie lange (ab etwa 40 Runden), werden die Bots schrittweise kompromissbereiter (`patience`).
2. **Häusermangel:** Die Bank hat keine Häuser mehr, niemand kommt zum Hotel. Dann baut ein Bot um wie ein echter Spieler: Häuser einer schwächeren Gruppe verkaufen und die stärkste Gruppe bis zum Hotel ausbauen. Jedes Hotel gibt vier Häuser an die Bank zurück.

## Prüfen

- `npm test`: Einzelfälle (`tests/bot.test.ts`), 100 gemischte Bot-Partien und 100 Zweikämpfe. Jede Aktion muss gültig sein, nach jeder Aktion gelten die Invarianten, jede Partie endet mit Gewinner, und «clever» gewinnt mindestens 70 % der Zweikämpfe gegen «einfach».
- `npm run bots -w @zueripoly/engine` (optional `-- --games 500 --check`): Tabelle mit Siegquoten je Paarung.

Ergebnis bei Abschluss von Phase 4 (200 Partien je Paarung):

| Paarung | beendet | Siege clever | Siege einfach | Ø Züge | max. Züge |
|---|---|---|---|---|---|
| einfach gegen einfach | 200 | – | 100 % | 137 | 389 |
| clever gegen einfach | 200 | 88 % | 13 % | 121 | 230 |
| clever gegen clever | 200 | 100 % | – | 123 | 212 |
| 1 clever gegen 3 einfach | 200 | 79 % | 21 % | 160 | 281 |
| 2 clever gegen 2 einfach | 200 | 93 % | 8 % | 156 | 307 |
| 6 gemischt (3 + 3) | 200 | 100 % | 1 % | 175 | 361 |

Bei gleich starken Bots würde «clever» als einer von vier nur in etwa 25 % der Partien gewinnen.
