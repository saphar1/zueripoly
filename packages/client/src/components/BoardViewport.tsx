// Zoom und Verschieben für das Brett auf kleinen Bildschirmen (design.md: Pinch, Tasten +/−).
// Das Brett wird einfach grösser gerechnet (--board-size = Passgrösse × Zoom); der Rahmen scrollt.
// Ab etwa 160 % zeigt das Brett wieder Feldnamen (Container-Abfrage im Brett).
import { type CSSProperties, type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import "./BoardViewport.css";

const MAX_ZOOM = 3;
const STEP = 0.5;
const SMALL_SCREEN = "(max-width: 899px)";

interface Point {
  x: number;
  y: number;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function BoardViewport({ children }: { children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [enabled, setEnabled] = useState(() => window.matchMedia(SMALL_SCREEN).matches);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  // Zoom gibt es nur auf kleinen Bildschirmen; auf dem Desktop passt das ganze Brett.
  useEffect(() => {
    const query = window.matchMedia(SMALL_SCREEN);
    const update = () => setEnabled(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  /** Auf einen Zoom springen; `focus` (im Rahmen) bleibt dabei an derselben Stelle. */
  const zoomTo = useCallback((next: number, focus?: Point) => {
    const element = scroller.current;
    if (!element) return;
    const target = Math.min(MAX_ZOOM, Math.max(1, Math.round(next * 100) / 100));
    const ratio = target / zoomRef.current;
    if (ratio === 1) return;
    const fx = focus?.x ?? element.clientWidth / 2;
    const fy = focus?.y ?? element.clientHeight / 2;
    const left = (element.scrollLeft + fx) * ratio - fx;
    const top = (element.scrollTop + fy) * ratio - fy;
    zoomRef.current = target;
    setZoom(target);
    requestAnimationFrame(() => element.scrollTo(left, top));
  }, []);

  useEffect(() => {
    if (!enabled) {
      zoomRef.current = 1;
      setZoom(1);
      return;
    }
    // Tasten + und − (nicht beim Tippen in Eingabefeldern), 0 = ganzes Brett.
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "+") zoomTo(zoomRef.current + STEP);
      else if (event.key === "-") zoomTo(zoomRef.current - STEP);
      else if (event.key === "0") zoomTo(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, zoomTo]);

  // Zwei Finger: Abstand bestimmt den Zoom, die Mitte zwischen den Fingern bleibt stehen.
  const toLocal = (event: PointerEvent): Point => {
    const box = scroller.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!enabled || event.pointerType !== "touch") return;
    pointers.current.set(event.pointerId, toLocal(event));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      pinch.current = { distance: distance(a, b), zoom: zoomRef.current };
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, toLocal(event));
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomTo((pinch.current.zoom * distance(a, b)) / pinch.current.distance, middle);
    }
  };
  const onPointerEnd = (event: PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  return (
    <div className={`viewport${enabled ? " viewport--zoomable" : ""}`} style={{ "--zoom": zoom } as CSSProperties}>
      <div
        ref={scroller}
        className="viewport__scroll"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {children}
      </div>
      {enabled && (
        <div className="viewport__controls" role="group" aria-label="Brett zoomen">
          <button type="button" className="viewport__button" onClick={() => zoomTo(zoomRef.current - STEP)} disabled={zoom <= 1} aria-label="Verkleinern">
            <Icon name="minus" />
          </button>
          <span className="viewport__level num" aria-live="polite">
            {Math.round(zoom * 100)} %
          </span>
          <button type="button" className="viewport__button" onClick={() => zoomTo(zoomRef.current + STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Vergrössern">
            <Icon name="plus" />
          </button>
        </div>
      )}
    </div>
  );
}
