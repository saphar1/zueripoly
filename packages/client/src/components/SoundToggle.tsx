// Stummschalter: immer sichtbar (Hauptmenü, Spiel-Kopfleiste, Desktop rechts unten). Standard: Ton an.
import { setPreference, usePreference } from "../preferences";
import { Icon } from "./Icon";
import "./SoundToggle.css";

export function SoundToggle({ className }: { className?: string }) {
  const sound = usePreference("sound");
  return (
    <button
      type="button"
      className={`button sound-toggle${className ? ` ${className}` : ""}`}
      aria-pressed={sound}
      aria-label="Ton"
      title={sound ? "Ton ausschalten" : "Ton einschalten"}
      onClick={() => setPreference("sound", !sound)}
    >
      <Icon name={sound ? "sound" : "soundOff"} className="sound-toggle__icon" />
      <span className="sound-toggle__label">{sound ? "Ton an" : "Ton aus"}</span>
    </button>
  );
}
