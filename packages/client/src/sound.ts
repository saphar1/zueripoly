// Töne, im Browser erzeugt (Web Audio, keine Dateien): kurz und leise (docs/design.md, Abschnitt 5).
// - Ton erst nach dem ersten Klick oder Tastendruck: Vorher erlauben Browser keinen Ton, und das Spiel soll
//   auch nicht von selbst losklingeln. Danach wird der AudioContext angelegt bzw. fortgesetzt.
// - Stummschalter: Einstellung «sound» in preferences.ts (Standard: an).
// - Kein Ton, wenn die Seite versteckt ist (anderer Tab), damit Bots im Hintergrund nicht lärmen.
import { getPreferences } from "./preferences";

export type SoundName = "dice" | "card" | "buy" | "build" | "money" | "jail" | "win";

/** Gesamtlautstärke (0–1): dezent. */
const VOLUME = 0.14;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function unlock(): void {
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = VOLUME;
      master.connect(context.destination);
      // Eine halbe Sekunde weisses Rauschen für Würfel und Karte (einmal erzeugt, mehrfach genutzt).
      noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.5), context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (context.state === "suspended") void context.resume();
  } catch {
    context = null;
  }
}

if (typeof window !== "undefined") {
  for (const type of ["pointerdown", "keydown"] as const) window.addEventListener(type, unlock, { capture: true, passive: true });
}

/** Ton mit Hüllkurve: schnell an, exponentiell aus. */
function tone(ctx: AudioContext, out: AudioNode, at: number, frequency: number, duration: number, type: OscillatorType, level = 1, endFrequency?: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** Kurzes gefiltertes Rauschen (Klick, Rascheln). */
function burst(ctx: AudioContext, out: AudioNode, at: number, duration: number, filter: BiquadFilterType, frequency: number, level = 1, endFrequency?: number): void {
  if (!noise) return;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = filter;
  band.frequency.setValueAtTime(frequency, at);
  if (endFrequency) band.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  band.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(band).connect(gain).connect(out);
  source.start(at, Math.random() * 0.3);
  source.stop(at + duration + 0.02);
}

const SOUNDS: Record<SoundName, (ctx: AudioContext, out: AudioNode, t: number) => void> = {
  // Würfel klappern: ein paar unregelmässige Klicks.
  dice: (ctx, out, t) => {
    for (const [offset, level] of [
      [0, 0.9],
      [0.07, 0.6],
      [0.15, 0.8],
      [0.21, 0.5],
      [0.33, 0.7],
      [0.42, 0.4],
    ] as const) {
      burst(ctx, out, t + offset, 0.035, "bandpass", 2200 + Math.random() * 1400, level);
    }
  },
  // Karte umdrehen: Papier, das kurz rauscht.
  card: (ctx, out, t) => burst(ctx, out, t, 0.18, "highpass", 1200, 0.7, 5000),
  // Kauf: Tramglocke «ding-ding».
  buy: (ctx, out, t) => {
    for (const offset of [0, 0.16]) {
      tone(ctx, out, t + offset, 1318, 0.45, "sine", 0.8);
      tone(ctx, out, t + offset, 2636, 0.2, "sine", 0.25);
    }
  },
  // Haus setzen: kurzes Klopfen auf Karton.
  build: (ctx, out, t) => {
    tone(ctx, out, t, 220, 0.12, "triangle", 0.9, 140);
    burst(ctx, out, t, 0.03, "lowpass", 900, 0.6);
  },
  // Geld: zwei helle Münzklänge.
  money: (ctx, out, t) => {
    tone(ctx, out, t, 1976, 0.09, "sine", 0.5);
    tone(ctx, out, t + 0.06, 2637, 0.14, "sine", 0.45);
  },
  // Gefängnis: tiefer Ton, der absinkt.
  jail: (ctx, out, t) => tone(ctx, out, t, 330, 0.45, "triangle", 0.8, 110),
  // Gewonnen: aufsteigender Dreiklang.
  win: (ctx, out, t) => {
    [523, 659, 784, 1047].forEach((frequency, i) => tone(ctx, out, t + i * 0.12, frequency, i === 3 ? 0.6 : 0.2, "triangle", 0.7));
  },
};

/** Ton abspielen, wenn erlaubt (nach dem ersten Klick, nicht stumm, Seite sichtbar). Fehler bleiben still. */
export function playSound(name: SoundName): void {
  if (!getPreferences().sound || !context || !master || context.state !== "running" || document.hidden) return;
  try {
    SOUNDS[name](context, master, context.currentTime + 0.01);
  } catch {
    // Ton ist Zugabe: nie das Spiel stören.
  }
}
