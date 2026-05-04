import { Badge } from "@/components/ui/card";
import {
  STATUS_LABEL,
  STATUS_TONE,
  STATUS_BUCKET_LABEL,
  STATUS_BUCKET_TONE,
  type ClientStatus,
  type StatusBucket,
} from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  const cs =
    (status as ClientStatus) in STATUS_LABEL
      ? (status as ClientStatus)
      : "ACTIVE";
  return (
    <Badge tone={STATUS_TONE[cs]} dot>
      {STATUS_LABEL[cs]}
    </Badge>
  );
}

/**
 * Coarse 3-bucket badge (Active / On-going / Idle). Used on the landing
 * page + client list for at-a-glance grouping.
 */
export function StatusBucketBadge({ bucket }: { bucket: StatusBucket }) {
  return (
    <Badge tone={STATUS_BUCKET_TONE[bucket]} dot>
      {STATUS_BUCKET_LABEL[bucket]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "CRITICAL"
      ? "danger"
      : priority === "HIGH"
        ? "warning"
        : priority === "LOW"
          ? "neutral"
          : "info";
  const label = priority.charAt(0) + priority.slice(1).toLowerCase();
  return <Badge tone={tone}>{label}</Badge>;
}
