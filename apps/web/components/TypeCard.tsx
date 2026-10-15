import Link from "next/link";
import type { Personality } from "@mentor-bti/bti-core";
import { CharacterPortrait } from "./CharacterPortrait";

export function TypeCard({ personality }: { personality: Personality }) {
  return (
    <Link className="type-card" href={`/types/${personality.code.toLowerCase()}`} style={{ "--type-color": personality.color } as React.CSSProperties}>
      <CharacterPortrait code={personality.code} name={personality.name} />
      <div className="type-card-copy">
        <span className="type-card-code">{personality.code}</span>
        <h3>{personality.name}</h3>
        <p>{personality.headline}</p>
      </div>
    </Link>
  );
}

