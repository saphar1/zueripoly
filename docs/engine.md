# ZüriPoly – Engine

Kurzbeschreibung von `packages/engine` für alle, die Oberfläche, Bots oder Server bauen.
Die Regeln selbst stehen in [regeln.md](regeln.md), Felder und Karten in [brett.md](brett.md).

## Grundidee

- Der **Spielstand** (`GameState`) ist reines JSON. Er wird nie verändert.
- Eine **Aktion** erzeugt einen neuen Spielstand:
  `applyAction(state, playerId, action, rng)` → `{ ok: true, state, events }` oder `{ ok: false, error }`.
- **Zufall** (Würfel, Mischen) kommt immer von aussen über `rng`. `createSeededRng(seed)` liefert eine seedbare Quelle; `getState()` speichert ihren Stand.
- Das **Protokoll** besteht aus Ereignissen (`GameEvent`), nicht aus Text. Die Oberfläche macht daraus deutsche Sätze. Jede Geldbewegung ist ein Ereignis `moneyTransferred`. `state.log` hält die letzten 200 Ereignisse, `applyAction` liefert die neuen zusätzlich als `events`.
- Fehlermeldungen kommen als `{ code, message }`; `message` ist auf Deutsch (de-CH).

## Wichtigste Funktionen

| Funktion | Zweck |
|---|---|
| `validateGameConfig(config)` | Lobby prüfen (2–6 Spieler, Figuren, Optionen). Gibt Fehlertext oder `null`. |
| `createGame(config, rng)` | Neues Spiel: Startreihenfolge auswürfeln, Stapel mischen. |
| `applyAction(state, playerId, action, rng)` | Aktion ausführen (prüft vorher alles). |
| `removePlayer(state, playerId)` | Eingriff von aussen (online: Host bei Abwesenheit): Spieler scheidet aus, Besitz an die Bank, Felder sind wieder frei. Kein Spielzug, gibt ein `ActionResult` zurück. |
| `getWaitingFor(state)` | Auf wen das Spiel wartet (oder `null` bei Spielende). |
| `getLegalActions(state, playerId)` | Gültige Aktionen (Gebote nur mit Mindestbetrag, Handel nicht). |
| `canProposeTrade(state, playerId)` | Darf der Spieler jetzt ein Handelsangebot machen? |
| `validateAction(state, playerId, action)` | Einzelne Aktion prüfen, z. B. ein Handelsangebot vor dem Absenden. |
| `calculateRent`, `liquidationValue`, `checkBuild`, … | Regelabfragen für Anzeige und Bots (`rules.ts`). |
| `serializeGame(state, rngState)` / `deserializeGame(json)` | Spielstand als JSON speichern und laden (mit Prüfung). |
| `checkInvariants(state)`, `checkMoneyLog(state, events)` | Selbsttests, z. B. nach dem Laden. |

## Aktionen

`rollDice`, `payJailFine`, `useJailCard`, `buyProperty`, `declineProperty`,
`buildHouse {space}`, `sellBuilding {space}`, `mortgage {space}`, `unmortgage {space}`,
`proposeTrade {offer}`, `acceptTrade {lift?}`, `rejectTrade`, `cancelTrade`,
`resolveMortgages {lift}`, `declareBankruptcy`, `endTurn`, `timeout`.

## Ablauf: Wer ist dran?

Das Spiel wartet immer auf **genau einen** Spieler (`getWaitingFor`). Vorrang von oben nach unten:

1. **Offenes Handelsangebot** (`state.trade`): Empfänger nimmt an oder lehnt ab. Der Anbieter darf zurückziehen.
2. **Hypothekenentscheid** (`state.mortgageDecision`): Nach einem Bankrott wählt der Gläubiger, welche belasteten Felder er sofort ablöst.
3. **Schuld** (`state.debts[0]`): Der Schuldner treibt Geld auf (verkaufen, belasten, handeln) oder erklärt Bankrott. Sobald das Bargeld reicht, zahlt die Engine automatisch.
4. **Zug** des Spielers `players[current]`, Phase `state.turn.phase`:
   - `preRoll`: würfeln, verwalten, handeln. Nach einem Pasch wieder `preRoll`. **Im Gefängnis** kein Würfeln (Fehler `inJail`), sondern `payJailFine` / `useJailCard` (danach würfeln) oder `endTurn` = einen Zug aussitzen (`jailTurns = 1`, Ereignis `jailTurnServed`). Zu Beginn des nächsten eigenen Zugs ist man frei (`leftJail`, `method: "served"`).
   - `buy`: freies Feld `turn.pendingBuy` kaufen oder ablehnen (das Feld bleibt frei, keine Versteigerung).
   - `postRoll`: verwalten, handeln, `endTurn`.

«Verwalten» heisst bauen, Gebäude verkaufen, belasten, Hypothek zurückzahlen.

## Spieler aus dem Spiel nehmen

`removePlayer(state, playerId)` geht jederzeit, auch wenn das Spiel gerade nicht auf diesen Spieler wartet. Reihenfolge:
1. Ereignis `playerRemoved`.
2. Ein offenes Angebot von ihm wird zurückgezogen, eines an ihn gilt als abgelehnt.
3. Ein Hypothekenentscheid von ihm verfällt (die Felder gehen ohnehin an die Bank).
4. Bankrott an die Bank (wie `goBankrupt`): Gebäude zurück, Bargeld an die Bank (nie in den Jackpot), Felder sind wieder frei (`propertyReturned`), Freikarten unter den Stapel. Schulden von ihm und an ihn verfallen.
5. Danach wie nach jeder Aktion: Zug weitergeben, Gewinner feststellen.

## Zeitlimit

Die Uhr läuft ausserhalb der Engine (Server oder Client). Ist die Zeit um, schickt sie für den wartenden Spieler `timeout`. Die Engine macht dann **einen** Standardschritt (würfeln oder im Gefängnis aussitzen, nicht kaufen, ablehnen, belastet lassen, Geld auftreiben oder Bankrott, Zug beenden). Ist danach immer noch derselbe Spieler dran, wird erneut `timeout` geschickt.

## Computergegner

`chooseBotAction(state, playerId, rng, level?)` schlägt für den wartenden Spieler genau eine Aktion vor; ausgeführt wird sie wie bei Menschen mit `applyAction`.
- `rng` ist eine **eigene** Zufallsquelle für die Bots (nie die des Spiels). `level` («easy» / «clever») überschreibt `PlayerState.bot`, z. B. wenn ein Bot für einen Menschen einspringt.
- Bots lesen nur öffentliches Wissen (nie `state.decks`) und merken sich nichts ausserhalb des Spielstands (Gedächtnis = Protokoll des laufenden Zuges).
- `BOT_NAMES` (Zürcher Vornamen für die Lobby), `BOT_LEVEL_NAMES` («einfach», «clever»).
- Verhalten, Fairness und Schleifenschutz: [bots.md](bots.md).

## Tests

`npm test` führt die Regeltests, 300 Zufallspartien, 50 Zufallspartien mit zufällig entfernten Spielern (`removePlayer`) und 200 Bot-Partien aus (siehe [bots.md](bots.md)), danach die Server-Tests (siehe [online.md](online.md)). In den Zufallspartien werden nach jeder Aktion die Invarianten geprüft (Gebäudevorrat 32/12, Besitz, Karten, kein negatives Geld, wer am Zug ist) und am Ende das ganze Geld-Protokoll nachgerechnet.
