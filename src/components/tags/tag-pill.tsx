import { Pill } from "@/components/ui/pill";
import type { Tag } from "@/lib/domain/types";

export function TagPill({ tag, suffix }: { tag: Pick<Tag, "name" | "color">; suffix?: string }) {
  return (
    <Pill tone={tag.color}>
      <span aria-hidden="true">#</span>
      {tag.name}
      {suffix}
    </Pill>
  );
}
