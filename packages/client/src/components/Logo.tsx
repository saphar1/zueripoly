// Logo: reine Typografie «ZüriPoly» mit einem Liniennummern-Kreis als Zeichen.
// Die Grösse kommt über font-size von aussen; alles darin rechnet in em.
import "./Logo.css";

export function Logo({ className }: { className?: string }) {
  return (
    <h1 className={`logo${className ? ` ${className}` : ""}`}>
      <span className="logo__badge" aria-hidden="true">
        Z
      </span>
      ZüriPoly
    </h1>
  );
}
