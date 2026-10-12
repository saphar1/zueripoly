// Tafel für Entscheidungen (design.md: keine Pop-ups, sondern eine Tafel neben dem Brett).
// Zeigt, auf wen das Spiel wartet und was diese Person jetzt tun kann. Angeboten wird nur, was die Engine erlaubt.
import { useEffect, useState, type ReactNode } from "react";
import type { Action, GameState, PlayerState, TradeSide } from "@zueripoly/engine";
import {
  BANK,
  BID_STEP,
  JAIL_FINE,
  MAX_JAIL_ROLLS,
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
import "./ActionPanel.css";

interface ActionPanelProps {
  state: GameState;
  busy: boolean;
  error: string | null;
  /** Restzeit in Sekunden, wenn ein Zeitlimit läuft. */
  secondsLeft: number | null;
  onAct: (action: Action) => void;
  onNewGame: () => void;
  onMenu: () => void;
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

export function ActionPanel({ state, busy, error, secondsLeft, onAct, onNewGame, onMenu }: ActionPanelProps) {
  const waitingId = getWaitingFor(state);
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
        <div className="tafel__body">
          <div className="tafel__actions">
            <button type="button" className="button button--primary" onClick={onNewGame}>
              Nochmals spielen
            </button>
            <button type="button" className="button" onClick={onMenu}>
              Zum Hauptmenü
            </button>
          </div>
        </div>
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

  if (state.trade) {
    const offer = state.trade;
    label = "Handelsangebot";
    body = (
      <>
        <p className="tafel__prompt">
          {nameOf(state, offer.from)} bietet <strong>{describeSide(offer.give)}</strong> und möchte dafür{" "}
          <strong>{describeSide(offer.take)}</strong>.
        </p>
        <ChoiceButtons
          legal={legal}
          disabled={disabled}
          onAct={onAct}
          choices={[
            { action: { type: "acceptTrade", lift: [] }, label: "Annehmen", primary: true },
            { action: { type: "rejectTrade" }, label: "Ablehnen" },
          ]}
        />
      </>
    );
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
    <section className="tafel" aria-live="polite" aria-busy={busy} aria-label={`${label}: ${player.name}`}>
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
        {error && <p className="tafel__error">{error}</p>}
      </div>
    </section>
  );
}
