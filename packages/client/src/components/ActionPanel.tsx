// Tafel für Entscheidungen (design.md: keine Pop-ups, sondern eine Tafel neben dem Brett).
// Zeigt, auf wen das Spiel wartet und was diese Person jetzt tun kann. Angeboten wird nur, was die Engine erlaubt.
// Lokal bedient jeder Mensch am Gerät die Tafel. Online (`me` gesetzt) nur der eigene Platz;
// wartet das Spiel auf jemand anderen, steht dort ein Satz zur Lage (wie bei Computergegnern).
import { useEffect, useState, type ReactNode } from "react";
import type { Action, GameState, PlayerId, PlayerState, SpaceIndex, TradeOffer, TradeSide } from "@zueripoly/engine";
import {
  BANK,
  BID_STEP,
  BOT_LEVEL_NAMES,
  JAIL_FINE,
  MAX_JAIL_ROLLS,
  canProposeTrade,
  getLegalActions,
  getPropertySpace,
  getSpace,
  getWaitingFor,
  minimumBid,
  mortgageInterest,
  unmortgageCost,
  validateAction,
} from "@zueripoly/engine";
import { formatChf } from "../format";
import { spaceNom } from "../game-text";
import { Token } from "./Token";
import { TradeComposer } from "./TradeComposer";
import "./ActionPanel.css";

interface ActionPanelProps {
  state: GameState;
  busy: boolean;
  error: string | null;
  /** Restzeit in Sekunden, wenn ein Zeitlimit läuft. */
  secondsLeft: number | null;
  /** Online: der eigene Platz. Lokal null (alle Menschen an diesem Gerät bedienen die Tafel). */
  me?: PlayerId | null;
  /** Online: Zusatz zum Wartenden, z. B. «Computer vertritt» (Kopf) oder «nicht verbunden» (Hinweis). */
  waitingLabel?: string | null;
  waitingNote?: string | null;
  /** Aktion für den wartenden Spieler (oder mit `as` für jemand anderen, z. B. Angebot zurückziehen). */
  onAct: (action: Action, as?: PlayerId) => void;
  /** Knöpfe nach Spielende (Nochmals spielen, Hauptmenü …). */
  endActions: ReactNode;
}

interface Choice {
  action: Action;
  label: string;
  primary?: boolean;
  danger?: boolean;
}

function nameOf(state: GameState, id: string): string {
  if (id === BANK) return "der Bank";
  return state.players.find((p) => p.id === id)?.name ?? id;
}

function isBot(state: GameState, id: PlayerId): boolean {
  return Boolean(state.players.find((p) => p.id === id)?.bot);
}

function describeSide(side: TradeSide): string {
  const parts = side.spaces.map((i) => getSpace(i).name);
  if (side.money > 0) parts.push(formatChf(side.money));
  if (side.jailCards.length > 0) parts.push(side.jailCards.length === 1 ? "Freikarte" : `${side.jailCards.length} Freikarten`);
  return parts.length > 0 ? parts.join(", ") : "nichts";
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function ChoiceButtons({ choices, legal, disabled, onAct }: { choices: Choice[]; legal: Action[]; disabled: boolean; onAct: (a: Action) => void }) {
  // Genau vergleichen: z. B. «alle auslösen» und «belastet lassen» sind beide resolveMortgages.
  const allowed = choices.filter((c) => legal.some((l) => JSON.stringify(l) === JSON.stringify(c.action)));
  return (
    <div className="tafel__actions">
      {allowed.map((choice) => (
        <button
          key={choice.label}
          type="button"
          className={`button${choice.primary ? " button--primary" : ""}${choice.danger ? " button--danger" : ""}`}
          disabled={disabled}
          onClick={() => onAct(choice.action)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function Auction({ state, bidder, disabled, onAct }: { state: GameState; bidder: PlayerState; disabled: boolean; onAct: (a: Action) => void }) {
  const auction = state.auction!;
  const min = minimumBid(auction);
  const [amount, setAmount] = useState(min);
  useEffect(() => setAmount(min), [min, bidder.id]);

  const bid: Action = { type: "bid", amount };
  const bidError = validateAction(state, bidder.id, bid);
  const space = getPropertySpace(auction.space);
  const others = auction.bidders.filter((id) => id !== bidder.id).map((id) => nameOf(state, id));

  return (
    <>
      <p className="tafel__prompt">
        Versteigerung: <strong>{spaceNom(auction.space)}</strong> (Listenpreis {formatChf(space.price)}).{" "}
        {auction.highestBidder
          ? `Höchstgebot: ${formatChf(auction.highestBid)} von ${nameOf(state, auction.highestBidder)}.`
          : "Noch kein Gebot."}
      </p>
      <div className="bid" role="group" aria-label="Gebot">
        <button type="button" className="button" disabled={disabled || amount - BID_STEP < min} onClick={() => setAmount(amount - BID_STEP)} aria-label={`${BID_STEP} CHF weniger`}>
          −{BID_STEP}
        </button>
        <output className="bid__amount num" aria-live="polite">
          {formatChf(amount)}
        </output>
        {[BID_STEP, 50, 100].map((step) => (
          <button key={step} type="button" className="button" disabled={disabled} onClick={() => setAmount(amount + step)} aria-label={`${step} CHF mehr`}>
            +{step}
          </button>
        ))}
      </div>
      <div className="tafel__actions">
        <button type="button" className="button button--primary" disabled={disabled || bidError !== null} onClick={() => onAct(bid)}>
          Bieten · {formatChf(amount)}
        </button>
        <button type="button" className="button" disabled={disabled} onClick={() => onAct({ type: "passBid" })}>
          Passen
        </button>
      </div>
      {bidError && amount > bidder.money && <p className="tafel__hint">So viel Bargeld hat {bidder.name} nicht ({formatChf(bidder.money)}).</p>}
      {others.length > 0 && <p className="tafel__hint">Noch dabei: {others.join(", ")}.</p>}
    </>
  );
}

interface TradeOfferViewProps {
  state: GameState;
  offer: TradeOffer;
  legal: Action[];
  disabled: boolean;
  /** Darf der Anbieter hier zurückziehen (lokal: Mensch am selben Gerät)? */
  canCancel: boolean;
  onAct: (action: Action, as?: PlayerId) => void;
}

/** Offenes Angebot: Empfänger nimmt an (belastete Felder wahlweise sofort auslösen) oder lehnt ab. */
function TradeOfferView({ state, offer, legal, disabled, canCancel, onAct }: TradeOfferViewProps) {
  const [lift, setLift] = useState<SpaceIndex[]>([]);
  const mortgaged = offer.give.spaces.filter((i) => state.properties[i]?.mortgaged);
  const accept: Action = { type: "acceptTrade", lift };
  const acceptError = validateAction(state, offer.to, accept);
  const canReject = legal.some((a) => a.type === "rejectTrade");
  return (
    <>
      <OfferTable state={state} offer={offer} />
      {mortgaged.map((index) => {
        const space = getPropertySpace(index);
        return (
          <label key={index} className="offer__lift">
            <input
              type="checkbox"
              checked={lift.includes(index)}
              onChange={() => setLift(lift.includes(index) ? lift.filter((i) => i !== index) : [...lift, index])}
            />
            {space.name} ist belastet: sofort auslösen ({formatChf(unmortgageCost(space))}), sonst Zins {formatChf(mortgageInterest(space))}
          </label>
        );
      })}
      <div className="tafel__actions">
        <button type="button" className="button button--primary" disabled={disabled || acceptError !== null} onClick={() => onAct(accept)}>
          Annehmen
        </button>
        {canReject && (
          <button type="button" className="button" disabled={disabled} onClick={() => onAct({ type: "rejectTrade" })}>
            Ablehnen
          </button>
        )}
        {canCancel && (
          <button type="button" className="button" disabled={disabled} onClick={() => onAct({ type: "cancelTrade" }, offer.from)}>
            {nameOf(state, offer.from)} zieht zurück
          </button>
        )}
      </div>
      {acceptError && <p className="tafel__hint">{acceptError.message}</p>}
    </>
  );
}

function OfferTable({ state, offer }: { state: GameState; offer: TradeOffer }) {
  return (
    <table className="offer">
      <tbody>
        <tr>
          <th scope="row">{nameOf(state, offer.from)} gibt</th>
          <td>{describeSide(offer.give)}</td>
        </tr>
        <tr>
          <th scope="row">und möchte</th>
          <td>{describeSide(offer.take)}</td>
        </tr>
      </tbody>
    </table>
  );
}

interface WatchStatusProps {
  state: GameState;
  /** Wer gerade entscheidet (Computergegner oder online ein anderer Mensch). */
  bot: PlayerState;
  disabled: boolean;
  /** Darf man hier das offene Angebot zurückziehen (eigenes Angebot)? */
  canCancel: boolean;
  onAct: (action: Action, as?: PlayerId) => void;
}

/** Jemand anderes ist dran (Computergegner, online ein anderer Mensch): keine Knöpfe, nur ein Satz zur Lage. */
function watchStatus({ state, bot, disabled, canCancel, onAct }: WatchStatusProps): { label: string; body: ReactNode } {
  const name = bot.name;
  if (state.trade) {
    const offer = state.trade;
    return {
      label: "Handelsangebot",
      body: (
        <>
          <OfferTable state={state} offer={offer} />
          <p className="tafel__prompt">{name} prüft das Angebot.</p>
          {canCancel && (
            <div className="tafel__actions">
              <button type="button" className="button" disabled={disabled} onClick={() => onAct({ type: "cancelTrade" }, offer.from)}>
                Angebot zurückziehen
              </button>
            </div>
          )}
        </>
      ),
    };
  }
  if (state.mortgageDecision) {
    return { label: "Hypotheken", body: <p className="tafel__prompt">{name} entscheidet, welche übernommenen Felder ausgelöst werden.</p> };
  }
  const debt = state.debts[0];
  if (debt) {
    return {
      label: "Schulden",
      body: (
        <p className="tafel__prompt">
          {name} schuldet {nameOf(state, debt.creditor)} <strong>{formatChf(debt.amount)}</strong> und treibt Geld auf. Es fehlen{" "}
          {formatChf(Math.max(0, debt.amount - bot.money))}.
        </p>
      ),
    };
  }
  if (state.auction) {
    const auction = state.auction;
    return {
      label: "Bietet jetzt",
      body: (
        <p className="tafel__prompt">
          Versteigerung: <strong>{spaceNom(auction.space)}</strong> (Listenpreis {formatChf(getPropertySpace(auction.space).price)}).{" "}
          {auction.highestBidder ? `Höchstgebot: ${formatChf(auction.highestBid)} von ${nameOf(state, auction.highestBidder)}.` : "Noch kein Gebot."}{" "}
          {name} bietet oder passt.
        </p>
      ),
    };
  }
  if (state.turn.phase === "buy" && state.turn.pendingBuy !== null) {
    const space = getPropertySpace(state.turn.pendingBuy);
    return {
      label: "Am Zug",
      body: (
        <p className="tafel__prompt">
          {name} entscheidet: <strong>{space.name}</strong> kaufen für {formatChf(space.price)}?
        </p>
      ),
    };
  }
  if (state.turn.phase === "preRoll") {
    const text = bot.inJail
      ? `${name} sitzt im Gefängnis und entscheidet: Kaution, Freikarte oder auf einen Pasch würfeln.`
      : state.turn.doublesCount > 0
        ? `Pasch! ${name} würfelt nochmals.`
        : `${name} würfelt gleich.`;
    return { label: "Am Zug", body: <p className="tafel__prompt">{text}</p> };
  }
  return { label: "Am Zug", body: <p className="tafel__prompt">{name} verwaltet den Besitz und beendet dann den Zug.</p> };
}

export function ActionPanel({ state, busy, error, secondsLeft, me = null, waitingLabel, waitingNote, onAct, endActions }: ActionPanelProps) {
  const waitingId = getWaitingFor(state);
  const [composing, setComposing] = useState(false);
  // Neuer Entscheid (anderer Spieler, Angebot verschickt): Handels-Tafel schliessen.
  useEffect(() => setComposing(false), [waitingId, state.trade]);
  // Zuschauen statt bedienen: ein Computergegner ist dran, oder online jemand anderes.
  const botTurn = waitingId !== null && isBot(state, waitingId);
  const watching = waitingId !== null && (botTurn || (me !== null && waitingId !== me));
  const tradeAllowed =
    waitingId !== null && !watching && canProposeTrade(state, waitingId) && state.players.filter((p) => !p.bankrupt).length > 1;
  const winner = state.winner ? state.players.find((p) => p.id === state.winner) : null;

  if (winner) {
    return (
      <section className="tafel tafel--end" aria-live="polite">
        <header className="tafel__head">
          <Token token={winner.token} />
          <div>
            <p className="tafel__label">Endstation</p>
            <h2 className="tafel__name">{winner.name} gewinnt ZüriPoly!</h2>
          </div>
        </header>
        <div className="tafel__body">{endActions}</div>
      </section>
    );
  }

  const player = state.players.find((p) => p.id === waitingId);
  if (!player) return null;
  const legal = getLegalActions(state, player.id);
  const disabled = busy;
  const ownsSomething = Object.values(state.properties).some((p) => p.owner === player.id);
  const manageHint = ownsSomething ? "Bauen, verkaufen oder belasten: Feld auf dem Brett anklicken." : null;

  let label = "Am Zug";
  let body: ReactNode;

  if (watching) {
    // Lokal darf ein Mensch sein Angebot an einen Bot zurückziehen; online nur das eigene Angebot.
    const offerFrom = state.trade?.from;
    const canCancel = offerFrom !== undefined && (me === null ? !isBot(state, offerFrom) : offerFrom === me);
    ({ label, body } = watchStatus({ state, bot: player, disabled, canCancel, onAct }));
    if (player.bot) label = `${label} · Computer, ${BOT_LEVEL_NAMES[player.bot]}`;
    else if (waitingLabel) label = `${label} · ${waitingLabel}`;
    if (waitingNote) {
      body = (
        <>
          {body}
          <p className="tafel__hint">{waitingNote}</p>
        </>
      );
    }
  } else if (composing && tradeAllowed) {
    label = "Handel";
    body = <TradeComposer state={state} from={player} disabled={disabled} onSend={(a) => onAct(a)} onCancel={() => setComposing(false)} />;
  } else if (state.trade) {
    label = "Handelsangebot";
    // Online steht der Anbieter nicht am selben Gerät: Zurückziehen kann er nur selbst.
    const canCancel = me === null && !isBot(state, state.trade.from);
    body = <TradeOfferView state={state} offer={state.trade} legal={legal} disabled={disabled} canCancel={canCancel} onAct={onAct} />;
  } else if (state.mortgageDecision) {
    const spaces = state.mortgageDecision.spaces.map((i) => getPropertySpace(i));
    const liftAll = spaces.reduce((sum, s) => sum + unmortgageCost(s), 0);
    const interest = spaces.reduce((sum, s) => sum + mortgageInterest(s), 0);
    label = "Hypotheken";
    body = (
      <>
        <p className="tafel__prompt">
          Übernommen mit Hypothek: <strong>{spaces.map((s) => s.name).join(", ")}</strong>. Jetzt auslösen oder belastet
          lassen und nur den Zins zahlen.
        </p>
        <ChoiceButtons
          legal={legal}
          disabled={disabled}
          onAct={onAct}
          choices={[
            {
              action: { type: "resolveMortgages", lift: state.mortgageDecision.spaces },
              label: `Alle auslösen · ${formatChf(liftAll)}`,
              primary: true,
            },
            { action: { type: "resolveMortgages", lift: [] }, label: `Belastet lassen · Zins ${formatChf(interest)}` },
          ]}
        />
      </>
    );
  } else if (state.debts[0]) {
    const debt = state.debts[0];
    label = "Schulden";
    body = (
      <>
        <p className="tafel__prompt">
          {player.name} schuldet {nameOf(state, debt.creditor)} <strong>{formatChf(debt.amount)}</strong>. Bargeld:{" "}
          {formatChf(player.money)}, es fehlen {formatChf(Math.max(0, debt.amount - player.money))}.
        </p>
        <p className="tafel__hint">Geld auftreiben: Feld anklicken und Gebäude verkaufen oder eine Hypothek aufnehmen. Sobald es reicht, wird automatisch bezahlt.</p>
        <ChoiceButtons
          legal={legal}
          disabled={disabled}
          onAct={onAct}
          choices={[{ action: { type: "declareBankruptcy" }, label: "Bankrott erklären", danger: true }]}
        />
      </>
    );
  } else if (state.auction) {
    label = "Bietet jetzt";
    body = <Auction state={state} bidder={player} disabled={disabled} onAct={onAct} />;
  } else if (state.turn.phase === "buy" && state.turn.pendingBuy !== null) {
    const space = getPropertySpace(state.turn.pendingBuy);
    body = (
      <>
        <p className="tafel__prompt">
          <strong>{space.name}</strong> ist noch frei. Kaufen für {formatChf(space.price)}? Bargeld: {formatChf(player.money)}.
        </p>
        <ChoiceButtons
          legal={legal}
          disabled={disabled}
          onAct={onAct}
          choices={[
            { action: { type: "buyProperty" }, label: `Kaufen · ${formatChf(space.price)}`, primary: true },
            { action: { type: "declineProperty" }, label: "Nicht kaufen, versteigern" },
          ]}
        />
        {!legal.some((a) => a.type === "buyProperty") && <p className="tafel__hint">Zu wenig Bargeld. Erst Geld auftreiben (Feld anklicken) oder versteigern.</p>}
      </>
    );
  } else if (state.turn.phase === "preRoll") {
    const prompt = player.inJail
      ? `Im Gefängnis, Versuch ${player.jailTurns + 1} von ${MAX_JAIL_ROLLS}. Pasch würfeln, Kaution zahlen oder Freikarte zeigen.`
      : state.turn.doublesCount > 0
        ? "Pasch! Nochmals würfeln."
        : "Bereit? Würfeln und losfahren.";
    body = (
      <>
        <p className="tafel__prompt">{prompt}</p>
        <ChoiceButtons
          legal={legal}
          disabled={disabled}
          onAct={onAct}
          choices={[
            { action: { type: "rollDice" }, label: player.inJail ? "Auf Pasch würfeln" : "Würfeln", primary: true },
            { action: { type: "payJailFine" }, label: `Kaution zahlen · ${formatChf(JAIL_FINE)}` },
            { action: { type: "useJailCard" }, label: "Freikarte zeigen" },
          ]}
        />
        {manageHint && <p className="tafel__hint">{manageHint}</p>}
      </>
    );
  } else {
    body = (
      <>
        <p className="tafel__prompt">Alles erledigt? Dann ist der nächste Halt beim nächsten Spieler.</p>
        <ChoiceButtons
          legal={legal}
          disabled={disabled}
          onAct={onAct}
          choices={[{ action: { type: "endTurn" }, label: "Zug beenden", primary: true }]}
        />
        {manageHint && <p className="tafel__hint">{manageHint}</p>}
      </>
    );
  }

  const urgent = secondsLeft !== null && secondsLeft <= 10;
  return (
    <section className="tafel" aria-live="polite" aria-busy={busy || watching} aria-label={`${label}: ${player.name}`}>
      <header className="tafel__head">
        <Token token={player.token} />
        <div>
          <p className="tafel__label">{label}</p>
          <h2 className="tafel__name">{player.name}</h2>
        </div>
        {secondsLeft !== null && (
          <span className={`tafel__clock num${urgent ? " tafel__clock--urgent" : ""}`} aria-label={`Noch ${secondsLeft} Sekunden`}>
            {clock(secondsLeft)}
          </span>
        )}
      </header>
      <div className="tafel__body">
        {body}
        {tradeAllowed && !composing && (
          <div className="tafel__more">
            <button type="button" className="button" disabled={disabled} onClick={() => setComposing(true)}>
              Handeln
            </button>
          </div>
        )}
        {error && <p className="tafel__error">{error}</p>}
      </div>
    </section>
  );
}
