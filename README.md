# ZüriPoly

Ein Brettspiel rund ums Geld, die Quartiere und die Trams von Zürich. Kaufe Strassen, baue Häuser, handle mit Freunden und lass die anderen Miete zahlen.

Alle Namen, Karten und Grafiken sind eigene Inhalte. Die Spielregeln folgen einem klassischen Immobilien-Brettspiel; dessen Name, Logo und Grafiken werden nicht verwendet.

**Stand:** Phase 3 abgeschlossen: Lokal spielbar an einem Gerät (2 bis 6 Personen), von Anfang bis Gewinner. Computergegner und Online-Spiel folgen. Siehe [PLAN.md](PLAN.md).

## Starten

Voraussetzung: Node.js 20 oder neuer, npm, Git (getestet mit Node 24 / npm 11 unter Windows 11).

```powershell
npm install
npm test
npm run dev
```

`npm run dev` startet den Server und die Client-Seite (Vite, normalerweise `http://localhost:5173`). Dort «Lokal spielen» wählen, Namen und Figuren eintragen, «Losfahren».

Nur die Oberfläche: `npm run dev -w @zueripoly/client`. Den Designentwurf (Stilreferenz) gibt es unter `http://localhost:5173/entwurf.html`.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `packages/engine` | Spiellogik (rein, getestet) |
| `packages/server` | Online-Server (Socket.IO) |
| `packages/client` | Oberfläche (Vite + React) |
| `docs/` | Regeln, Brett, Design |

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
