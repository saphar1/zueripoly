# ZüriPoly – Online-Spiel

Wie Server und Browser zusammenspielen (Phase 5). Code: `packages/server`, im Client `src/online/`, `game/use-online-game.ts` und die Bildschirme `OnlineStart`, `OnlineLobby`, `OnlineRoom`, `OnlineGameScreen`.

## Grundidee

- **Der Server ist die einzige Wahrheit.** Er hält pro Raum den Spielstand (`GameState`), die Spiel-Zufallsquelle (Würfel, Mischen) und eine eigene Zufallsquelle für die Bots.
- **Browser schicken nur Wünsche** («würfeln», «kaufen», «Gebot 120 CHF») und zeigen an, was der Server zurückschickt. Sie rechnen nie selbst einen Zug aus.
- **Jede Aktion prüft die Engine** (`applyAction`) für den Platz der Verbindung. Die Spieler-ID kommt nie aus der Nachricht, sondern aus der Verbindung. Ist jemand nicht dran oder ist die Aktion nicht erlaubt, kommt die deutsche Fehlermeldung der Engine zurück und nichts ändert sich.
- **Geheimes bleibt auf dem Server:** die Reihenfolge der Kartenstapel und der Zustand der Zufallsquelle. Browser bekommen die Stapel sortiert (die Anzahl stimmt, die Reihenfolge nicht).
- **Dieselbe Engine** läuft im Browser (Solo, Lokal) und auf dem Server (Online). Die Anzeige (`GameView`) ist für alle Spielarten dieselbe.

## Verbindung

Socket.IO über dieselbe Adresse wie die Seite. Im Entwickeln leitet Vite `/socket.io` an den Server weiter (`vite.config.ts`, Ziel änderbar mit der Umgebungsvariable `ZUERIPOLY_SERVER`). Der Server läuft auf Port 3001 (`PORT` überschreibt).

Anfragen haben immer eine Antwort (Socket.IO «ack»): `{ ok: true, … }` oder `{ ok: false, error }`. Die Typen stehen in `packages/server/src/protocol.ts`; der Client importiert sie über `@zueripoly/server/protocol`.

| Anfrage | Wer | Zweck |
|---|---|---|
| `room:create {name}` | alle | Raum eröffnen, du bist Host. Antwort: Code, Sitzplatz-Schlüssel, Platz (`p1`–`p6`) |
| `room:join {code, name}` | alle | Beitreten (nur in der Lobby, höchstens 6 Plätze) |
| `room:resume {code, seatKey}` | alle | Zurück auf den eigenen Platz (Lobby oder Spiel) |
| `room:leave` | alle | Verlassen. Lobby: Platz weg. Spiel: Platz bleibt, der Host entscheidet |
| `lobby:seat {name?, token?, ready?}` | alle | Eigener Name, Figur (jede nur einmal), bereit |
| `lobby:options`, `lobby:addBot`, `lobby:botLevel`, `lobby:removeSeat`, `lobby:start` | Host | Optionen, Computergegner, Plätze entfernen, Start |
| `game:action {action}` | alle | Spielzug des eigenen Platzes (`timeout` ist verboten, das schickt nur der Server) |
| `game:sync` | alle | Vollstand nochmals schicken lassen |
| `game:absent {seatId, decision}` | Host | Entscheid für einen abwesenden Platz: `wait`, `bot`, `remove` |
| `game:toLobby` | Host | Nach Spielende alle zurück in die Lobby |

Nachrichten vom Server:

| Nachricht | Inhalt |
|---|---|
| `room:state` | Raum (Phase, Host, Plätze mit bereit / verbunden / getrennt seit / ausgestiegen / vertreten / Entscheid nötig, Optionen, dein Platz) |
| `game:update` | Fortlaufende Nummer `seq`, Spielstand, neue Ereignisse. `sync: true` = Vollstand ohne Abspielen |
| `game:clock` | Restzeit des Zeitlimits für den aktuellen Entscheid (oder `null`) |
| `room:closed` | Du bist nicht mehr im Raum (entfernt, Platz in anderem Fenster geöffnet, Raum aufgelöst) |

## Räume und Lobby

- **Raumcode:** 5 Zeichen aus `ACDEFGHJKMNPRTUVWXY346789`, also ohne 0/O/Q, 1/I/L, 2/Z, 5/S, 8/B. Erzeugt mit kryptografischem Zufall. Eingaben werden vereinheitlicht (Grossbuchstaben, ohne Leerzeichen und Bindestriche).
- **Link:** `/?raum=CODE` füllt den Code auf dem Online-Start vor.
- **Plätze:** `p1` bis `p6`, Namen im Raum eindeutig (ohne Gross-/Kleinschreibung), jede Figur nur einmal.
- **Start:** nur der Host, mindestens 2 Plätze, alle Menschen verbunden, alle ausser dem Host bereit.
- **Nach Spielende:** Der Host holt alle zurück in die Lobby (gleiche Plätze, Ausgestiegene fallen weg, alle wieder «nicht bereit»).

## Wiederverbinden und Abwesenheit

- Wer einen Platz bekommt, erhält einen geheimen **Sitzplatz-Schlüssel**. Der Browser speichert ihn im `sessionStorage` (pro Fenster, überlebt Neuladen) und im `localStorage` (das Online-Menü bietet «Zurück in Raum …» an). So können mehrere Fenster im selben Browser verschiedene Spieler sein.
- Bricht die Verbindung ab, verbindet Socket.IO von selbst neu und der Browser meldet sich mit dem Schlüssel wieder an. Er bekommt den Vollstand und spielt ab dort weiter.
- Öffnet jemand denselben Platz in einem zweiten Fenster, wird das erste abgemeldet.
- **Anzeige:** Spielerpanel und Lobby zeigen «Getrennt» (gestrichelter roter Rahmen), «Ausgestiegen» und «Computer vertritt».
- **Nach 60 Sekunden** (`Timing.absentMs`) sieht der Host eine Störungsmeldung: *Warten* (fragt nach weiteren 60 Sekunden wieder), *Computer spielt weiter* (Stufe clever; kommt die Person zurück, spielt sie wieder selbst) oder *Aus dem Spiel nehmen* (`removePlayer` der Engine: Besitz an die Bank, Felder werden versteigert). Wer das Spiel ausdrücklich verlässt, kommt nicht zurück; der Entscheid ist sofort nötig (ohne «Warten»).
- **Host-Wechsel:** Verlässt der Host den Raum, wird sofort der nächste verbundene Mensch Host. Ist der Host länger als 60 Sekunden getrennt, ebenso. Kommt er zurück, bleibt der neue Host.
- **Alle Menschen getrennt:** Das Spiel ruht (keine Bot-Züge, kein Zeitlimit).

## Tempo, Bots und Zeitlimit

- Bots und Vertretungen ziehen auf dem Server mit denselben Denkpausen wie im Solo-Spiel (1 s, Folgeschritte 0,5 s, nach einer Karte 2 s). Dazu wartet der Server die ungefähre Abspielzeit der letzten Bewegung ab (`pace.ts`), damit man im Browser alles mitbekommt.
- Das **Zeitlimit** läuft nur auf dem Server. Er schickt die Restzeit (`game:clock`) und nach Ablauf `timeout` für den Wartenden. Zur Frist kommt die Abspielzeit plus 0,5 s für die Übertragung, die Uhr im Browser zeigt aber höchstens das gewählte Limit.

## Robustheit und Grenzen

- Jede Eingabe wird in `parse.ts` **neu gebaut**: nur bekannte Felder, Zahlen ganzzahlig und im Bereich, Listen begrenzt, keine fremden Schlüssel (auch nicht `__proto__`).
- **Namen:** Steuer- und Richtungszeichen werden entfernt, Leerraum zusammengefasst, höchstens 16 Zeichen. Angezeigt wird immer als Text (React), nie als HTML.
- **Flutbremse** pro Verbindung (`rate-limit.ts`): Vorrat 20 Nachrichten, 10 pro Sekunde Nachschub. Darüber gibt es eine Fehlermeldung, nach 40 abgelehnten Nachrichten wird die Verbindung getrennt.
- Nachrichten höchstens **16 KB**, höchstens **500 Räume**. Unbekannte Nachrichten bekommen «Unbekannte Nachricht.».
- Jede Anfrage und jeder Zeitgeber laufen in `try/catch`: Fehler werden protokolliert, der Server läuft weiter.
- **Aufräumen:** Leere Lobby (niemand verbunden) nach 5 Minuten, leeres Spiel nach 10 Minuten. Räume ohne Menschen sofort.
- Spielstände werden noch **nicht gespeichert**: Startet der Server neu, sind die Räume weg (Phase 6).

## Tests

`npm test` führt auch die Server-Tests aus (`packages/server/tests`, Vitest). Simulierte Browser (Socket.IO-Clients) spielen gegen einen Server mit kurzen Zeiten (`FAST` in `tests/helpers.ts`):

| Datei | Prüft |
|---|---|
| `lobby.test.ts` | Raumcode, Beitreten (auch klein geschrieben), voller Raum, Namen, Figuren, Host-Rechte, Bots, Start, Host-Wechsel in der Lobby |
| `game.test.ts` | 2, 3 und 4 Spieler spielen mindestens 10 Züge (alle sehen denselben Stand), eine ganze Partie bis zum Gewinner, Bots, Aktionen ausserhalb des eigenen Zugs, ungültige Aktionen, geheime Stapelreihenfolge, Zeitlimit |
| `reconnect.test.ts` | Getrennt-Anzeige, Wiederverbinden mit vollem Stand, falscher Schlüssel, zweites Fenster, Host-Entscheide (warten, Computer, entfernen), Host-Wechsel, ruhendes Spiel, Aufräumen |
| `robustness.test.ts` | kaputte Nachrichten, `__proto__`, zu grosse Nachrichten, Flutbremse, Namen |

Oberfläche: `npm run playtest -w @zueripoly/client -- --online` (drei Browserfenster spielen eine Partie, eines lädt mittendrin neu) und `npm run screenshots -w @zueripoly/client -- --online`.
