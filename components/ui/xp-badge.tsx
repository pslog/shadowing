import { Badge } from "./badge";
import { Icon } from "./icon";

export function XPBadge({ xp }: { xp: number }) {
  return (
    <Badge tone="primary" className="tabular-nums">
      <Icon name="star" size={13} filled />
      {xp.toLocaleString("ja-JP")} XP
    </Badge>
  );
}
