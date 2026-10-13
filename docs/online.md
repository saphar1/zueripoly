# ZüriPoly – Online-Spiel

Wie Server und Browser zusammenspielen und wie Freunde mitspielen (Phase 5). Code: `packages/server`, im Client `src/online/`, `game/use-online-game.ts` und die Bildschirme `OnlineStart`, `OnlineLobby`, `OnlineRoom`, `OnlineGameScreen`.

## Grundidee

- **Der Server ist die einzige Wahrheit.** Er hält pro Raum den Spielstand (`GameState`), die Spiel-Zufallsquelle (Würfel, Mischen) und eine eigene Zufallsquelle für die Bots.
- **Browser schicken nur Wünsche** («würfeln», «kaufen», «Gebot 120 CHF») und zeigen an, was der Server zurückschickt. Sie rechnen nie selbst einen Zug aus.
- **Jede Aktion prüft die Engine** (`applyAction`) für den Platz der Verbindung. Die Spieler-ID kommt nie aus der Nachricht, sondern aus der Verbindung. Ist jemand nicht dran oder ist die Aktion nicht erlaubt, kommt die deutsche Fehlermeldung der Engine zurück und nichts ändert sich.
- **Geheimes bleibt auf dem Server:** die Reihenfolge der Kartenstapel und der Zustand der Zufallsquelle. Browser bekommen die Stapel sortiert (die Anzahl stimmt, die Reihenfolge nicht).
- **Dieselbe Engine** läuft im Browser (Solo, Lokal) und auf dem Server (Online). Die Anzeige (`GameView`) ist für alle Spielarten dieselbe.

## Mit Freunden spielen

Zwei Wege, beide gratis (Entscheid 2026-10-13):

| | Im Internet | Im gleichen WLAN |
|---|---|---|
| Adresse | `https://<github-name>.github.io/zueripoly/` | `http://<PC-Adresse>:3001`, z. B. `http://10.9.21.208:3001` |
| Seite | GitHub Pages (fertige Dateien, baut bei jedem Push auf `main`) | dein PC (`npm start`) |
| Spielserver | Render, Gratisstufe, Frankfurt | dein PC (`npm start`) |
| Dein PC muss laufen | nein | ja |
| Grenzen | Server schläft nach 15 Minuten ohne Spiel, Aufwachen bis 1 Minute. Neustart (auch jeder Push) löscht alle Räume. | Gäste-WLAN trennt Geräte oft voneinander. Server-Neustart löscht alle Räume. |

Solo und Lokal laufen ganz im Browser und brauchen den Spielserver nicht. Auf GitHub Pages starten sie darum immer sofort, auch wenn der Server schläft.

### Im Internet

Freunden einfach die Pages-Adresse schicken (oder in der Lobby «Link kopieren»). Schläft der Server, steht unter «Online mit Freunden» «Der Spielserver schläft und wird gerade geweckt …», und die Seite verbindet sich von selbst, sobald er wach ist.

Einrichtung (einmalig):
1. GitHub: öffentliches Repository, Settings → Pages → Source «GitHub Actions». Der Workflow `.github/workflows/pages.yml` testet (`npm test`), baut und veröffentlicht bei jedem Push auf `main`.
2. Render: New → Blueprint → Repository wählen. `render.yaml` beschreibt den Dienst (Gratisstufe, Frankfurt, Build `npm ci --include=dev && npm run build`, Start `npm run start -w @zueripoly/server`, Prüfung `/healthz`). Render baut bei jedem Push auf `main` neu. Node-Version aus `.node-version`.
3. Render fragt dabei nach `ZUERIPOLY_ORIGINS`: `https://<github-name>.github.io` (die Seite, die verbinden darf; mehrere mit Komma). Später änderbar unter Render → Dienst → Environment.
4. GitHub → Settings → Secrets and variables → Actions → Variables: `ZUERIPOLY_SERVER_URL = https://<dienst>.onrender.com`. Danach den Workflow neu laufen lassen (Actions → «Seite auf GitHub Pages» → Run workflow), denn die Adresse wird beim Bauen eingebaut.

Die Render-Adresse zeigt das Spiel ebenfalls (der Server liefert die gebaute Seite selbst aus) und taugt als Ersatz.

### Im gleichen WLAN

1. Im Projektordner `npm start`. Das baut die Seite und startet den Server, der Seite und Spiel unter einer Adresse ausliefert. Er nennt seine Adressen:
   ```
   Spiel öffnen:
     Auf diesem PC:     http://localhost:3001
     Im gleichen WLAN:  http://10.9.21.208:3001
   ```
2. Raum eröffnen. Läuft die Seite auf `localhost`, zeigt die Lobby den Link mit der WLAN-Adresse; den bekommen die Freunde.
3. **Windows-Firewall:** Beim ersten Start fragt Windows, ob Node.js im Netzwerk erreichbar sein darf: **«Private Netzwerke» ankreuzen und zulassen.** Das WLAN muss in Windows als «Privates Netzwerk» eingestellt sein (Einstellungen → Netzwerk und Internet → WLAN → Eigenschaften). Wurde die Frage weggeklickt, sperrt Windows Node.js; freigeben unter «Windows-Sicherheit → Firewall- und Netzwerkschutz → Zugriff von App durch Firewall zulassen».

Wenn es nicht geht:
- Handy wirklich im selben WLAN (nicht Mobilfunk, nicht Gäste-WLAN)?
- VPN auf PC oder Handy aus?
- Die Adresse kann sich nach einem Router-Neustart ändern: neu ablesen.
- Der Server nennt auch «andere Adapter» (VirtualBox, VMware, WSL …). Die WLAN-Adresse ist die, über die der PC ins Internet geht (`routeAddress` in `lan.ts`); die anderen nur ausprobieren, wenn sie nicht klappt.
- `http://` statt `https://`: Der Browser darf dann nicht selbst in die Zwischenablage schreiben; «Link kopieren» markiert den Link, kopieren mit Ctrl+C (Handy: lange drücken).

### Später (recherchiert 2026-10-13)

| Möglichkeit | Kosten | Bemerkung |
|---|---|---|
| Eigene Domain (z. B. `zueripoly.ch`) | ca. CHF 7–12 pro Jahr | bei GitHub Pages und Render (2 Domains gratis) anschliessbar; Code bleibt gleich, nur `ZUERIPOLY_BASE` wird `/` |
| Cloudflare-Tunnel vom eigenen PC | 0, kein Konto | `cloudflared tunnel --url http://localhost:3001`, Adresse wechselt bei jedem Start, laut Cloudflare nur zum Testen |
| Render bezahlt, Fly.io, Railway, eigener Server | ca. 2–7 $ pro Monat | schläft nicht |
| Verworfen | | Koyeb (Gratisstufe läuft aus), ngrok (Warnseite, Konto), Tailscale Funnel (Konto, kein Vorteil), Glitch (eingestellt) |

## Verbindung

Socket.IO. Ohne weitere Angabe über dieselbe Adresse wie die Seite: Im Entwickeln leitet Vite `/socket.io` an den Server weiter (`vite.config.ts`, Ziel änderbar mit der Umgebungsvariable `ZUERIPOLY_SERVER`), mit `npm start` und auf Render liefert der Server die Seite selbst aus. Der Server läuft auf Port 3001 (`PORT` überschreibt).

Liegt die Seite woanders als der Server (GitHub Pages → Render), wird die Serveradresse beim Bauen eingebaut: `VITE_ZUERIPOLY_SERVER`. Der Server erlaubt fremde Seiten nur, wenn sie in `ZUERIPOLY_ORIGINS` stehen (Socket.IO `cors` und `allowRequest`, `origin.ts`). Webseiten von anderen Adressen werden abgelehnt (Polling 403, WebSocket getrennt); Programme ohne `Origin` (Tests) dürfen.

| Umgebungsvariable | Wo | Zweck |
|---|---|---|
| `PORT` | Server | Port (Standard 3001; Render setzt ihn selbst) |
| `ZUERIPOLY_ORIGINS` | Server | Fremde Seiten, die verbinden dürfen, mit Komma getrennt |
| `ZUERIPOLY_CLIENT_DIR` | Server | Ordner der gebauten Seite (Standard `packages/client/dist`) |
| `ZUERIPOLY_BASE` | Bauen | Pfad der Seite (Standard `/`, GitHub Pages `/zueripoly/`) |
| `VITE_ZUERIPOLY_SERVER` | Bauen | Adresse des Spielservers, wenn nicht dieselbe wie die Seite |
| `ZUERIPOLY_SERVER` | Entwickeln | Ziel der Vite-Weiterleitung (Tests) |

Weitere HTTP-Adressen des Servers neben `/socket.io`: `/healthz` (immer «ok», für Render), `/api/lan-addresses` (WLAN-Adressen, nur für Anfragen vom eigenen PC, sonst wie jede unbekannte Adresse), sonst die gebaute Seite (`static-files.ts`: nur GET/HEAD, nur Dateien im Ordner, `/assets/*` ein Jahr zwischenspeichern, alles andere `no-cache`). Ohne gebaute Seite (oder mit `--dev` aus `npm run dev`) antwortet er mit einem kurzen Text.

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
- Spielstände werden noch **nicht gespeichert**: Startet der Server neu, sind die Räume weg (Phase 6). Auf Render passiert das bei jedem Push und wenn der Dienst schlafen geht.

## Tests

`npm test` führt auch die Server-Tests aus (`packages/server/tests`, Vitest). Simulierte Browser (Socket.IO-Clients) spielen gegen einen Server mit kurzen Zeiten (`FAST` in `tests/helpers.ts`):

| Datei | Prüft |
|---|---|
| `lobby.test.ts` | Raumcode, Beitreten (auch klein geschrieben), voller Raum, Namen, Figuren, Host-Rechte, Bots, Start, Host-Wechsel in der Lobby |
| `game.test.ts` | 2, 3 und 4 Spieler spielen mindestens 10 Züge (alle sehen denselben Stand), eine ganze Partie bis zum Gewinner, Bots, Aktionen ausserhalb des eigenen Zugs, ungültige Aktionen, geheime Stapelreihenfolge, Zeitlimit |
| `reconnect.test.ts` | Getrennt-Anzeige, Wiederverbinden mit vollem Stand, falscher Schlüssel, zweites Fenster, Host-Entscheide (warten, Computer, entfernen), Host-Wechsel, ruhendes Spiel, Aufräumen |
| `robustness.test.ts` | kaputte Nachrichten, `__proto__`, zu grosse Nachrichten, Flutbremse, Namen |
| `static.test.ts` | Seite ausliefern: Dateien, Typen, Zwischenspeichern, 404/405, keine Pfad-Ausbrüche (`..`, `%2e%2e`, `\`), `/healthz` |
| `lan.test.ts` | WLAN-Adressen (private IPv4, virtuelle Adapter weg, Weg ins Internet zuerst), nur der eigene PC bekommt sie |
| `origin.test.ts` | erlaubte Seite (CORS), gleiche Adresse, ohne Origin, fremde Seite abgelehnt (Polling und WebSocket) |

Oberfläche: `npm run playtest -w @zueripoly/client -- --online` (drei Browserfenster spielen eine Partie, eines lädt mittendrin neu) und `npm run screenshots -w @zueripoly/client -- --online`. Mit `-- --online --prod` spielt der Test «Pages + Render» nach: Seite gebaut unter `/zueripoly/` mit eingebauter Serveradresse, ausgeliefert von einem eigenen Server, Spielserver unter einer anderen Adresse, der nur diese Seite erlaubt (Bilder `online-prod-*.png`).
