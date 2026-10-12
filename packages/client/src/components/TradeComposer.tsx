// Handelsangebot erstellen: zwei Spalten «Du gibst» und «Du bekommst» (design.md: TradeDialog als Tafel).
// Geprüft wird laufend mit validateAction; die Engine liefert die deutsche Begründung.
import { type CSSProperties, useMemo, useState } from "react";
import type { Action, GameState, PlayerId, PlayerState, SpaceIndex, TradeProposal } from "@zueripoly/engine";
import {
  PROPERTY_INDICES,
  getPropertySpace,
  isFreeOfBuildings,
  mortgageInterest,
  unmortgageCost,
  validateAction,
} from "@zueripoly/engine";
import { formatChf } from "../format";
import { Token } from "./Token";
import "./TradeComposer.css";

interface TradeComposerProps {
  state: GameState;
  from: PlayerState;
  disabled: boolean;
  onSend: (action: Action) => void;
  onCancel: () => void;
}

interface SideDraft {
  spaces: SpaceIndex[];
  money: number;
  jailCards: string[];
}

const EMPTY: SideDraft = { spaces: [], money: 0, jailCards: [] };

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function barColor(index: SpaceIndex): string {
  const space = getPropertySpace(index);
  if (space.kind === "street") return `var(--group-${space.group})`;
  return space.kind === "station" ? "var(--group-station)" : "var(--group-utility)";
}

interface SideProps {
  title: string;
  owner: PlayerState;
  state: GameState;
  draft: SideDraft;
  onChange: (draft: SideDraft) => void;
  /** Nur auf der «Du bekommst»-Seite: belastete Felder sofort auslösen? */
  lift?: SpaceIndex[];
  onLiftChange?: (lift: SpaceIndex[]) => void;
}

function Side({ title, owner, state, draft, onChange, lift, onLiftChange }: SideProps) {
  const owned = PROPERTY_INDICES.filter((i) => state.properties[i]?.owner === owner.id);
  return (
    <fieldset className="trade-side">
      <legend className="trade-side__title">{title}</legend>
      {owned.length === 0 && <p className="trade-side__empty">Keine Felder.</p>}
      <ul className="trade-side__spaces">
        {owned.map((index) => {
          const space = getPropertySpace(index);
          const property = state.properties[index]!;
          const tradable = isFreeOfBuildings(state, space);
          const checked = draft.spaces.includes(index);
          return (
            <li key={index}>
              <label className={`trade-space${tradable ? "" : " trade-space--blocked"}`} style={{ "--bar": barColor(index) } as CSSProperties}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!tradable}
                  onChange={() => onChange({ ...draft, spaces: toggle(draft.spaces, index) })}
                />
                <span className="trade-space__name">{space.name}</span>
                {property.mortgaged && <span className="trade-space__note">Hypothek</span>}
                {!tradable && <span className="trade-space__note">Gruppe hat Gebäude</span>}
              </label>
              {checked && property.mortgaged && lift && onLiftChange && (
                <label className="trade-space__lift">
                  <input type="checkbox" checked={lift.includes(index)} onChange={() => onLiftChange(toggle(lift, index))} />
                  Sofort auslösen ({formatChf(unmortgageCost(space))}), sonst Zins {formatChf(mortgageInterest(space))}
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {owner.jailCards.map((card) => (
        <label key={card} className="trade-space" style={{ "--bar": "var(--color-tram)" } as CSSProperties}>
          <input type="checkbox" checked={draft.jailCards.includes(card)} onChange={() => onChange({ ...draft, jailCards: toggle(draft.jailCards, card) })} />
          <span className="trade-space__name">Freikarte</span>
        </label>
      ))}
      <label className="trade-money">
        <span>Geld</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={owner.money}
          step={10}
          value={draft.money === 0 ? "" : draft.money}
          placeholder="0"
          onChange={(e) => {
            const value = Math.max(0, Math.floor(Number(e.target.value) || 0));
            onChange({ ...draft, money: value });
          }}
        />
        <span className="trade-money__max">von {formatChf(owner.money)}</span>
      </label>
    </fieldset>
  );
}

export function TradeComposer({ state, from, disabled, onSend, onCancel }: TradeComposerProps) {
  const partners = state.players.filter((p) => !p.bankrupt && p.id !== from.id);
  const [partnerId, setPartnerId] = useState<PlayerId>(partners[0]?.id ?? "");
  const [give, setGive] = useState<SideDraft>(EMPTY);
  const [take, setTake] = useState<SideDraft>(EMPTY);
  const [lift, setLift] = useState<SpaceIndex[]>([]);
  const partner = partners.find((p) => p.id === partnerId);

  const action = useMemo<Action | null>(() => {
    if (!partner) return null;
    const offer: TradeProposal = {
      to: partner.id,
      give,
      take,
      lift: lift.filter((i) => take.spaces.includes(i)),
    };
    return { type: "proposeTrade", offer };
  }, [partner, give, take, lift]);

  const isEmpty = give.spaces.length + give.jailCards.length + give.money + take.spaces.length + take.jailCards.length + take.money === 0;
  const problem = action && !isEmpty ? validateAction(state, from.id, action) : null;

  const choosePartner = (id: PlayerId) => {
    setPartnerId(id);
    setTake(EMPTY);
    setLift([]);
  };

  return (
    <div className="trade">
      <div className="trade__partners" role="radiogroup" aria-label="Mit wem handeln?">
        {partners.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === partnerId}
            className="trade__partner"
            onClick={() => choosePartner(p.id)}
          >
            <Token token={p.token} />
            {p.name}
          </button>
        ))}
      </div>
      {partner && (
        <div className="trade__sides">
          <Side title="Du gibst" owner={from} state={state} draft={give} onChange={setGive} />
          <Side title={`Du bekommst von ${partner.name}`} owner={partner} state={state} draft={take} onChange={setTake} lift={lift} onLiftChange={setLift} />
        </div>
      )}
      {problem && <p className="tafel__error">{problem.message}</p>}
      <div className="tafel__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={disabled || !action || isEmpty || problem !== null}
          onClick={() => action && onSend(action)}
        >
          Angebot senden
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
