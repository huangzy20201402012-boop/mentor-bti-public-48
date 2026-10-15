import Link from "next/link";
import type { ResearchDomain } from "@mentor-bti/bti-core";

export function DomainCard({ domain }: { domain: ResearchDomain }) {
  return (
    <Link className="domain-card" href={`/domains#${domain.code}`} style={{ "--domain": domain.color, "--domain-light": domain.lightColor, "--domain-dark": domain.darkColor } as React.CSSProperties}>
      <span>{domain.code}</span>
      <strong>{domain.name}</strong>
      <p>{domain.subtitle}</p>
      <small>{domain.worldview}</small>
    </Link>
  );
}
