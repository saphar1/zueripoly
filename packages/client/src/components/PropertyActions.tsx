// Knöpfe auf der Besitzkarte: bauen (auch gratis mit Baubewilligung), Gebäude verkaufen, Hypothek aufnehmen, auslösen.
// Angeboten wird nur, was die Engine jetzt erlaubt. Geht Bauen nicht, steht der Grund darunter.
import type { Action, ErrorCode, GameState, PlayerId, SpaceIndex } from "@zueripoly/engine";
import { HOTEL_LEVEL, getPropertySpace, unmortgageCost, validateAction } from "@zueripoly/engine";
import { formatChf } from "../format";
import "./PropertyActions.css";

interface Option {
  action: Action;
  label: string;
}

/** Gründe, die beim Bauen etwas über die Regeln erklären (andere wie «nicht dran» zeigen wir nicht). */
const BUILD_REASONS: readonly ErrorCode[] = [
  "groupIncomplete",
  "groupMortgaged",
  "unevenBuilding",
  "noHousesLeft",
  "noHotelsLeft",
  "notEnoughMoney",
];

interface PropertyActionsProps {
  state: GameState;
  actor: PlayerId;
  index: SpaceIndex;
  disabled: boolean;
  onAct: (action: Action) => void;
}

export function PropertyActions({ state, actor, index, disabled, onAct }: PropertyActionsProps) {
  const property = state.properties[index];
  if (!property || property.owner !== actor) return null;
  const space = getPropertySpace(index);

  const options: Option[] = [];
  const build: Action = { type: "buildHouse", space: index };
  const permit: Action = { type: "useBuildPermit", space: index };
  if (space.kind === "street") {
    const building = property.houses === HOTEL_LEVEL - 1 ? "Hotel" : "Haus";
    options.push({ action: permit, label: `${building} gratis bauen · Baubewilligung` });
    options.push({ action: build, label: `${building} bauen · ${formatChf(space.housePrice)}` });
    // Hat die Bank keine 4 Häuser für den Rückbau, wird das Hotel ganz abgerissen (Engine: Wert von 5 Bauten).
    const demolish = property.houses === HOTEL_LEVEL && state.bank.houses < HOTEL_LEVEL - 1;
    const refund = (space.housePrice / 2) * (demolish ? HOTEL_LEVEL : 1);
    options.push({
      action: { type: "sellBuilding", space: index },
      label: `${property.houses === HOTEL_LEVEL ? "Hotel" : "Haus"} verkaufen · +${formatChf(refund)}${demolish ? " · Hotel wird ganz abgerissen" : ""}`,
    });
  }
  options.push({ action: { type: "mortgage", space: index }, label: `Hypothek aufnehmen · +${formatChf(space.mortgage)}` });
  options.push({ action: { type: "unmortgage", space: index }, label: `Auslösen · ${formatChf(unmortgageCost(space))}` });

  const legal = options.filter((o) => validateAction(state, actor, o.action) === null);
  // Mit Baubewilligung ist fehlendes Bargeld kein Grund, nicht zu bauen.
  const permitOk = legal.some((o) => o.action.type === "useBuildPermit");
  const buildError = space.kind === "street" && property.houses < HOTEL_LEVEL && !permitOk ? validateAction(state, actor, build) : null;
  const reason = buildError && BUILD_REASONS.includes(buildError.code) ? buildError.message : null;
  if (legal.length === 0 && !reason) return null;

  return (
    <div className="property-actions">
      {legal.map((option) => (
        <button key={option.action.type} type="button" className="button" disabled={disabled} onClick={() => onAct(option.action)}>
          {option.label}
        </button>
      ))}
      {reason && <p className="property-actions__reason">Bauen: {reason}</p>}
    </div>
  );
}
