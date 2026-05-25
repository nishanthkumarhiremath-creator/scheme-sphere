export type DeadlineUrgency = "normal" | "warning" | "urgent" | "hidden";

export type DeadlineDisplay = {
  label: string;
  urgency: DeadlineUrgency;
};

export function getDeadlineDisplay(end_date: string): DeadlineDisplay {
  if (!end_date) {
    return { label: "", urgency: "hidden" };
  }

  const deadline = new Date(end_date);
  if (Number.isNaN(deadline.getTime())) {
    return { label: "", urgency: "hidden" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const daysLeft = Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft < 0) {
    return { label: "", urgency: "hidden" };
  }

  if (daysLeft <= 7) {
    return {
      label: `🔴 URGENT - ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`,
      urgency: "urgent"
    };
  }

  if (daysLeft <= 30) {
    return {
      label: `⚠ ${daysLeft} days left`,
      urgency: "warning"
    };
  }

  return {
    label: `Ends: ${new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(deadline)}`,
    urgency: "normal"
  };
}
