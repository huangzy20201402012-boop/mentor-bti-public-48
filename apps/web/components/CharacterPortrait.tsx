import { btiContent } from "@mentor-bti/bti-content";

interface CharacterPortraitProps {
  code: string;
  name: string;
  className?: string;
}

/** Public source uses a CSS portrait until artwork publication rights are confirmed. */
export function CharacterPortrait({ code, name, className = "" }: CharacterPortraitProps) {
  const color = btiContent.personalities.find((personality) => personality.code === code)?.color ?? "#667085";
  return (
    <div
      className={`character-portrait ${className}`}
      role="img"
      aria-label={`${name}类型标识`}
      style={{ "--portrait-color": color } as React.CSSProperties}
    >
      <div className="character-portrait-fallback" aria-hidden="true"><span>◈</span><strong>{code}</strong></div>
    </div>
  );
}
