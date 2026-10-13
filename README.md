# ZüriPoly

Ein Brettspiel rund ums Geld, die Quartiere und die Trams von Zürich. Kaufe Strassen, baue Häuser, handle mit Freunden und lass die anderen Miete zahlen.

Alle Namen, Karten und Grafiken sind eigene Inhalte. Die Spielregeln folgen einem klassischen Immobilien-Brettspiel; dessen Name, Logo und Grafiken werden nicht verwendet.

**Stand:** Lokal, Solo gegen Computergegner und Online mit Raumcode spielbar, auch mit Freunden auf ihren eigenen Geräten: im Internet (Seite auf GitHub Pages, Spielserver auf Render) oder im gleichen WLAN (`npm start`). Siehe [PLAN.md](PLAN.md).

## Starten

Voraussetzung: Node.js 20 oder neuer, npm, Git (getestet mit Node 24 / npm 11 unter Windows 11).

```powershell
npm install
npm test
npm run dev
```

`npm run dev` startet den Spielserver (Port 3001) und die Client-Seite (Vite, normalerweise `http://localhost:5173`). Dort «Lokal spielen», «Solo gegen den Computer» oder «Online mit Freunden» wählen.

Online ausprobieren: Im ersten Fenster «Online mit Freunden» → Name → «Raum eröffnen». In einem zweiten Fenster (oder Tab) dieselbe Adresse öffnen, «Online mit Freunden» → Name → Raumcode → «Beitreten» → «Ich bin bereit». Dann startet der Host mit «Losfahren». Wie das Online-Spiel funktioniert: [docs/online.md](docs/online.md).

**Mit Freunden spielen**
- Im Internet: die Adresse der Seite auf GitHub Pages schicken (`https://<github-name>.github.io/zueripoly/`). Der Gratis-Spielserver schläft nach 15 Minuten ohne Spiel; beim ersten Online-Besuch dauert das Aufwecken bis zu einer Minute. Solo und Lokal starten immer sofort.
- Im gleichen WLAN: `npm start` baut die Seite und startet den Server, der alles unter einer Adresse ausliefert. Er nennt die WLAN-Adresse (z. B. `http://10.9.21.208:3001`), die Lobby zeigt den passenden Link. Beim ersten Start in der Windows-Firewall Node.js für «Private Netzwerke» zulassen.

Einrichtung und Hilfe: [docs/online.md](docs/online.md), Abschnitt «Mit Freunden spielen».

Nur die Oberfläche: `npm run dev -w @zueripoly/client`. Den Designentwurf (Stilreferenz) gibt es unter `http://localhost:5173/entwurf.html`.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `packages/engine` | Spiellogik (rein, getestet) |
| `packages/server` | Online-Server (Socket.IO) |
| `packages/client` | Oberfläche (Vite + React) |
| `docs/` | Regeln, Brett, Design, Engine, Bots, Online |

## Spielanleitung (Kurzfassung)

- 2 bis 6 Spieler, je 1500 CHF Startkapital, 200 CHF beim Überqueren von Start.
- Würfeln, ziehen, auf unbesetzten Feldern kaufen oder versteigern lassen, auf fremden Feldern Miete zahlen.
- Wer alle Strassen einer Farbe besitzt, darf Häuser und Hotels bauen (gleichmässig). Die Bank hat 32 Häuser und 12 Hotels.
- Ein Pasch gibt einen weiteren Wurf, der dritte Pasch führt ins Gefängnis.
- Hypotheken, Handel zwischen Spielern, Ereignis- und Gemeindekarten.
- Wer zahlungsunfähig wird, scheidet aus. Gewonnen hat der Letzte, der noch im Spiel ist.

Alle Details: [docs/regeln.md](docs/regeln.md). Das Brett: [docs/brett.md](docs/brett.md). Die Gestaltung: [docs/design.md](docs/design.md). Die Spiellogik: [docs/engine.md](docs/engine.md).

## Spielmodi

- **Solo** gegen 1 bis 5 Computergegner (einfach oder clever)
- **Lokal** mit mehreren Spielern an einem Gerät
- **Online** mit Raumcode
