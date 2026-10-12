# ZüriPoly – Spielregeln

Verbindliche Regelgrundlage für die Engine (`packages/engine`). Was hier steht, wird dort umgesetzt und getestet.
Zahlen und Felder stehen in [brett.md](brett.md). Alle Texte: Deutsch, Schweizer Schreibweise (immer «ss», nie «ß»).

## 1. Ziel
Wer als Letzter noch Geld und Besitz hat, gewinnt. Alle anderen gehen nach und nach bankrott.

## 2. Spielstart
- 2 bis 6 Spieler (Menschen und/oder Computergegner). Jeder wählt eine Figur: Tram, Schwan, Böögg, Fondue-Caquelon, Velo, Kaffeebecher (jede Figur nur einmal).
- Startkapital: **1500 CHF** (Option, siehe Abschnitt 14).
- Bank: **32 Häuser** und **12 Hotels**, unbegrenzt Geld.
- Alle Figuren starten auf **Start** (Feld 0). Beide Kartenstapel werden gemischt.
- Die Startreihenfolge wird ausgewürfelt (höchste Augensumme beginnt, bei Gleichstand wird unter den Gleichen neu gewürfelt). Danach geht es im Uhrzeigersinn.

## 3. Ablauf eines Zugs
1. **Vor dem Würfeln** (optional): bauen, verkaufen, Hypothek aufnehmen oder zurückzahlen, handeln.
2. **Würfeln** mit zwei Würfeln und die Figur im Uhrzeigersinn um die Augensumme ziehen.
3. **Feld auswerten** (Abschnitte 4 bis 9).
4. **Nach dem Würfeln** (optional): wie unter 1.
5. **Zug beenden.** Der nächste Spieler ist dran.

Bauen, Hypotheken und Handel sind nur auf dem **eigenen Zug** möglich, sowie in jedem Moment, in dem ein Spieler Geld auftreiben muss, um eine Schuld zu bezahlen (Abschnitt 11). *(Vereinfachung gegenüber dem Original, damit Online-Spiele ohne Chaos laufen.)*

### Pasch
- Ein **Pasch** (beide Würfel gleich) gibt nach dem Auswerten des Feldes **einen weiteren Wurf**.
- Der **dritte Pasch in Folge** schickt den Spieler **sofort ins Gefängnis**, ohne dass er zieht.
- Ein Spieler, der per Pasch aus dem Gefängnis kommt, zieht, würfelt aber **nicht** noch einmal.

## 4. Start
- Beim **Vorbeiziehen oder Landen** auf Start erhält man **200 CHF**. Man erhält nicht doppelt, wenn man genau darauf landet.
- Kein Geld gibt es, wenn man ins Gefängnis geschickt wird oder rückwärts gezogen wird (Karte «Gehe 3 Felder zurück»).
- Karten, die «vorrücken» sagen, zahlen die 200 CHF, wenn dabei Start überquert wird.

## 5. Felder kaufen
Landet ein Spieler auf einem **unbesetzten** Grundstück (Strasse, Bahnhof, Versorger):
- Er darf es zum aufgedruckten **Preis** kaufen. Dann erhält er die Besitzkarte.
- Kauft er nicht, wird das Feld sofort **versteigert** (Abschnitt 6).

## 6. Versteigerung
- Alle noch im Spiel befindlichen Spieler dürfen bieten, **auch der Spieler, der nicht gekauft hat**.
- Eröffnungsgebot ab **10 CHF**, jedes Gebot muss das letzte um mindestens **10 CHF** übersteigen.
- Reihum, beginnend links vom Spieler, der gerade am Zug ist. Wer aussteigt («Passen»), bleibt draussen.
- Es gewinnt das letzte verbliebene Gebot. Wer bietet, muss das Geld **sofort** haben (Bargeld; Gebäude verkaufen oder Hypotheken aufnehmen vor dem eigenen Gebot ist erlaubt, bauen und handeln nicht). Niemand bietet: Das Feld bleibt unbesetzt.
- Dasselbe Verfahren gilt für Grundstücke, die bei einem Bankrott an die Bank fallen (Abschnitt 12), und für Häuser bei Hausknappheit (Abschnitt 8).

## 7. Miete
Landet man auf einem Feld, das einem anderen Spieler gehört (und nicht hypothekarisch belastet ist), zahlt man **Miete** an den Besitzer. Der Besitzer muss sie nicht einfordern; die Engine verbucht sie automatisch.
- **Hypothekarisch belastete Felder** bringen keine Miete.
- Ein Besitzer, der **im Gefängnis** ist, erhält trotzdem Miete.
- **Strassen:**
  - Ohne Haus: Grundmiete. Besitzt der Spieler **alle Strassen der Farbgruppe** (und keine ist belastet), ist die Miete **doppelt**, solange kein Haus steht.
  - Mit 1 bis 4 Häusern oder 1 Hotel: Mietstaffel aus brett.md.
  - Innerhalb einer Farbgruppe bleibt die Verdopplung für unbebaute Strassen auch dann bestehen, wenn eine andere Strasse der Gruppe bebaut ist.
- **Bahnhöfe:** 25 / 50 / 100 / 200 CHF bei 1 / 2 / 3 / 4 Bahnhöfen im Besitz des Eigentümers. Gezählt werden alle Bahnhöfe im Besitz, auch belastete (diese bringen selbst aber keine Miete).
- **Versorger:** Besitzt der Eigentümer **einen** Versorger: **4 ×** die gewürfelte Augensumme; beide: **10 ×** die Augensumme. Auch hier zählen belastete Versorger beim Zählen mit.
  - Wer wegen einer Ereigniskarte zum Versorger muss, würfelt neu und zahlt **10 ×** die neue Augensumme.
  - Wer wegen einer Ereigniskarte zum nächsten Bahnhof muss, zahlt dem Besitzer die **doppelte** Miete.

## 8. Bauen: Häuser und Hotels
- Bauen darf man nur, wenn man **alle Strassen einer Farbgruppe** besitzt und **keine davon** belastet ist. Bahnhöfe und Versorger werden nicht bebaut.
- **Gleichmässig bauen:** Der Unterschied zwischen den Strassen einer Gruppe darf nie mehr als **ein Haus** betragen. Man baut reihum je ein Haus pro Strasse.
- Ein **Hotel** kostet den Hauspreis und die 4 Häuser der Strasse (diese gehen zurück an die Bank). Voraussetzung: **alle Strassen der Gruppe haben mindestens 4 Häuser** (oder ein Hotel). Pro Strasse höchstens 1 Hotel.
- Die Bank hat **32 Häuser und 12 Hotels**. Sind keine Häuser mehr da, kann niemand ein Haus bauen. Weil nur der Spieler am Zug bauen darf, wollen nie zwei Spieler gleichzeitig dieselben Häuser: Wer zuerst am Zug ist, baut zuerst. Eine Versteigerung von Häusern gibt es deshalb nicht.
- **Verkaufen:** Häuser und Hotels gehen zur **Hälfte des Hauspreises** zurück an die Bank. Auch hier gilt **gleichmässig** (von der am höchsten bebauten Strasse zuerst). Ein Hotel wird zu 4 Häusern zurückgebaut (das Hotel geht zurück an die Bank, 4 Häuser kommen aus deren Vorrat). Sind nicht 4 Häuser frei, kann das Hotel nur ganz abgerissen werden; dafür gibt es die Hälfte des Preises von 5 Bauten (Hotel = 5 Hauspreise). Die Gruppe ist danach ungleich bebaut; das ist erlaubt. Es gilt weiter: gebaut wird immer auf einer Strasse mit der **tiefsten**, verkauft von einer mit der **höchsten** Stufe der Gruppe.
- Vor einer **Hypothek** auf eine Strasse müssen alle Gebäude **der ganzen Gruppe** verkauft sein.
- Gebäude dürfen **nicht gehandelt** werden: Zum Handel müssen alle Gebäude der Farbgruppe vorher an die Bank verkauft werden.

## 9. Gefängnis
**Wer ins Gefängnis kommt**
- Landen auf **«Gehe ins Gefängnis»** (Feld 30).
- Ziehen einer Karte «Gehe direkt ins Gefängnis».
- **Dritter Pasch** in Folge.
Dann: Figur direkt auf Feld 10 (Gefängnis), **ohne Start-Geld**, der Zug endet **sofort** (auch bei Pasch): kein weiterer Wurf. Verwalten (bauen, belasten, handeln) und «Zug beenden» bleiben möglich.

**Wer nur «zu Besuch» auf Feld 10 landet**, ist nicht im Gefängnis und zieht ganz normal weiter.

**Wie man herauskommt** (nur im Gefängnis, bei jedem Zug **vor** dem Würfeln wählen):
1. **50 CHF zahlen** und danach normal würfeln und ziehen.
2. **Freikarte** abgeben (Karte geht zurück unter den Stapel) und normal würfeln und ziehen.
3. **Würfeln und einen Pasch erzielen**: Figur zieht die Augensumme, der Spieler würfelt aber **nicht** noch einmal.

Wird in drei aufeinanderfolgenden eigenen Zügen kein Pasch erzielt, muss der Spieler nach dem **dritten** Zug **50 CHF zahlen** und sofort mit der gewürfelten Augensumme ziehen. Kann er nicht bar zahlen, zieht er trotzdem; die 50 CHF werden zur Schuld, die vor allen späteren Zahlungen beglichen werden muss (Abschnitt 11).

Im Gefängnis darf man weiterhin **Miete einfordern, bauen, handeln** und Hypotheken aufnehmen.

## 10. Steuerfelder, Ereignis- und Gemeindefelder, Ferien
- **Steuerfelder** (Feld 4: 200 CHF, Feld 38: 100 CHF): Der Betrag geht an die Bank (mit Jackpot an den Jackpot, siehe 14).
- **Ereignis-** und **Gemeindefelder:** Oberste Karte des entsprechenden Stapels ziehen, vorlesen, ausführen und **unter den Stapel** legen. Ausnahme: **Freikarte**, die der Spieler behält, bis er sie einsetzt oder verkauft/tauscht; sie wird erst dann wieder unter den Stapel gelegt.
- Bei Karten mit Bewegung gelten die normalen Regeln für das Zielfeld (Kaufen, Miete, Karte, Steuer). Ein Spieler, der per Karte auf ein Karten- oder Steuerfeld rückt, führt auch dieses aus.
- **Ferien am Zürichsee** (Feld 20): Ohne Jackpot-Option **passiert nichts**. Mit Jackpot-Option siehe Abschnitt 14.

## 11. Schulden und Geld auftreiben
Wer Geld schuldet (Miete, Steuer, Karte, Gefängnisgebühr), das er nicht bar hat:
1. Er **muss** Geld auftreiben durch Verkauf von Gebäuden (zu ½ Hauspreis), **Hypotheken** aufnehmen und **Handel**.
2. Er darf Grundstücke nicht «einfach so» verschenken; nur über den Handel (Abschnitt 13).
3. Kommt er nicht auf die Schuld, ist er **bankrott** (Abschnitt 12).
Wer zahlen **kann**, muss zahlen (kein Aufschieben). Die Engine bucht jede Zahlung automatisch ab, sobald genug Bargeld da ist; der Schuldner muss nur Geld auftreiben.
- Mehrere Schulden (z. B. «Zahle jedem Mitspieler 50», «Jeder Mitspieler zahlt dir 50») werden **der Reihe nach** beglichen, beginnend beim nächsten Spieler in Zugreihenfolge. Solange eine Schuld offen ist, wartet das Spiel auf diesen Schuldner.
- Während einer Schuld darf der Schuldner nur: Gebäude verkaufen, Hypotheken aufnehmen, handeln oder (wenn nichts mehr reicht) Bankrott erklären.

### Hypotheken
- Ein unbebautes Grundstück kann von der Bank belastet werden und bringt den **Hypothekenwert** (½ des Preises) in bar.
- **Belastete Felder** bringen **keine Miete**; Karten bleiben im Besitz des Spielers.
- **Zurückzahlen:** Hypothekenwert plus **10 % Zins** (aufgerundet auf den nächsten ganzen Franken).
- Hat der Spieler weitere Strassen der Gruppe und löst eine Hypothek nicht ein, bleibt die Verdopplung wegen belasteter Strasse **aus**.
- Beim Handel mit belasteten Feldern: Der Käufer zahlt sofort **10 %** des Hypothekenwerts als Zins und darf entscheiden, ob er die Hypothek **sofort ablöst** (Hypothekenwert + 10 %) oder belastet lässt (dann nur die 10 % Zins).

## 12. Bankrott
Ein Spieler ist bankrott, wenn er eine Schuld nicht bezahlen kann, auch nach Verkauf aller Gebäude und Aufnahme aller Hypotheken. **Bankrott erklären** geht nur, wenn Bargeld + Verkaufswert aller Gebäude + alle noch möglichen Hypotheken zusammen nicht reichen.
- **Schulden bei einem Mitspieler:** Alle Grundstücke und Freikarten gehen an den **Gläubiger**. Gebäude werden vorher zu ½ Hauspreis an die Bank verkauft (das Geld geht an den Gläubiger). Belastete Felder: Der Gläubiger zahlt sofort **10 %** und darf wie im Handel entscheiden (sofort ablösen oder belastet lassen). Sein restliches Bargeld erhält der Gläubiger ebenfalls.
- **Schulden bei der Bank** (Steuer, Karte): Alles geht an die Bank. Gebäude zurück in den Vorrat, Grundstücke werden einzeln **versteigert** (unbelastet; vorher Hypotheken aufgehoben, kein Zins), Freikarten gehen unter den Stapel.
- Fehlt dem Gläubiger das Geld für den Zins auf übernommene belastete Felder, entsteht eine Schuld bei der Bank.
- Der Restbetrag einer Schuld bei der Bank (Bargeld des Bankrotteurs) fliesst mit Jackpot-Option in den Topf, wenn die Schuld eine Steuer, Karte oder Gefängnisgebühr war.
- Der bankrotte Spieler scheidet aus. Seine übrigen offenen Schulden (und Schulden an ihn) verfallen. War er am Zug, ist nach den Versteigerungen der nächste Spieler dran.
- **Gewonnen** hat der letzte verbliebene Spieler.

## 13. Handel
- Auf dem eigenen Zug (und bei Schuld) darf ein Spieler jedem anderen ein Angebot machen. Beide Seiten dürfen enthalten: **Grundstücke, Bargeld, Freikarten**, in beliebiger Kombination.
- Das Angebot ist erst gültig, wenn der andere **zustimmt**. Der Anbieter kann es bis dahin zurückziehen.
- Beide Seiten müssen genug Bargeld haben für das, was sie bieten.
- **Grundstücke mit Gebäuden** (in der Farbgruppe) dürfen nicht gehandelt werden (Abschnitt 8).
- Belastete Felder: siehe Abschnitt 11. Der Anbieter entscheidet beim Angebot, welche erhaltenen belasteten Felder er sofort ablöst, der Empfänger beim Annehmen.
- Ein Handel darf **keine Schuld** erzeugen: Jede Seite muss nach dem Tausch Zins und Ablösung bar bezahlen können, sonst ist das Angebot ungültig.
- Es gibt immer höchstens **ein offenes Angebot**. Solange es offen ist, wartet das Spiel auf die Antwort.
- Computergegner prüfen Angebote nach ihrer Logik (siehe `docs/bots.md`).
- Es gibt **keine** versteckten Absprachen: Gegenleistungen wie «Ich zahle dir künftig keine Miete» sind keine Spielregel und werden nicht umgesetzt.

## 14. Optionen in der Lobby
| Option | Standard | Wirkung |
|---|---|---|
| **Jackpot bei Ferien am Zürichsee** | aus | Alle Zahlungen an die Bank (Steuern, Kartenbussen, Gefängnisgebühr) fliessen in einen Topf. Wer auf **Ferien am Zürichsee** landet, erhält den ganzen Topf. Der Topf startet bei 0. Aus: Zahlungen gehen an die Bank, Ferien tut nichts. |
| **Zeitlimit pro Zug** | aus (Wahl: 30 / 60 / 90 Sekunden) | Läuft die Zeit ab, wird für den Spieler automatisch gehandelt: würfeln, wenn er noch nicht gewürfelt hat; **nicht kaufen** (also Versteigerung); Zug beenden. In anderen Lagen: bei Versteigerung passen, Handelsangebot ablehnen, belastete Felder belastet lassen, bei Schuld automatisch Geld auftreiben (zuerst belasten, dann Gebäude verkaufen) oder Bankrott. Nur in Online-Spielen und lokal mit Zeitlimit-Anzeige. Computergegner sind davon unberührt. |
| **Startkapital** | 1500 CHF | Wählbar von 500 bis 5000 CHF in 100er-Schritten. Gilt für alle Spieler. |

## 15. Sonderfälle
- **Gleichstand** beim Auswürfeln der Startreihenfolge: Nur die Gleichen würfeln erneut.
- **Gebäude und Mietberechnung** zählen am Moment der Landung.
- **Wer auf sich selbst Miete zahlen müsste**, zahlt nichts (eigenes Feld).
- **Geld kann nicht negativ** bleiben: Ein negativer Kontostand führt sofort zu Schuld und Bankrottprüfung.
- **Freikarte**: Pro Spieler beliebig viele; sie sind handelbar.
- **Mehrere Pasch**: Der zweite Pasch führt ganz normal zu einem weiteren Wurf, der dritte ins Gefängnis.
- **Karte «Zahle jedem Spieler 50»**: Nur an noch im Spiel befindliche Spieler.
- **Reparaturen-Karte**: Betrag pro Haus/Hotel des Spielers; ohne Gebäude zahlt er nichts.
- **Wenn der Stapel durch ist**, wird er (ohne die gehaltenen Freikarten) neu gemischt. In der Praxis laufen die Karten im Kreis unter den Stapel, deshalb ist ein Mischen nur beim Spielstart nötig.
- **Wiederverbinden** (online): Verliert ein Spieler die Verbindung, behält er seinen Platz und wartet das Spiel, wenn er entscheiden muss (mit Zeitlimit handelt der Server nach Ablauf für ihn). Nach 1 Minute Abwesenheit entscheidet der Host: warten, ein Computergegner spielt weiter (bis der Spieler zurück ist) oder der Spieler wird aus dem Spiel genommen. Dann geht sein Besitz wie bei einem Bankrott an die Bank: Gebäude zurück, Bargeld an die Bank, Felder werden versteigert, sein offenes Handelsangebot verfällt, ein Gebot von ihm in einer Versteigerung gilt nicht mehr. Details: [online.md](online.md).

## 16. Entscheide, die vom Original abweichen
Diese bewussten Vereinfachungen sind hier festgehalten, damit sie später nicht verwundern:
1. Bauen, Hypotheken und Handel nur auf dem eigenen Zug oder bei Schuld.
2. Handel mit Gebäuden ist nicht erlaubt; sie müssen vorher verkauft werden.
3. Versteigerung beginnt immer bei 10 CHF mit Mindeststufe 10 CHF.
4. Einkommenssteuer ist fix 200 CHF (kein «10 %»-Wahlrecht).
5. Das Zeitlimit und der Jackpot sind Lobby-Optionen und standardmässig aus.
6. Keine Versteigerung von Häusern bei Häusermangel (nur der Spieler am Zug baut, siehe Abschnitt 8).
7. Doppelte Grundmiete nur, wenn **keine** Strasse der Farbgruppe belastet ist (im Original genügt der Besitz).
8. Nach dem dritten Pasch oder einer Gefängniskarte darf der Spieler vor «Zug beenden» noch verwalten.
9. Ein Handel darf keine Schuld erzeugen (Abschnitt 13).
10. Mehrere Schulden aus einer Karte werden der Reihe nach beglichen; geht der Zahler dabei bankrott, verfallen die übrigen (Abschnitt 11).
11. Online kann der Host einen abwesenden Spieler aus dem Spiel nehmen; sein Besitz geht wie bei einem Bankrott an die Bank (Abschnitt 15, Wiederverbinden).
