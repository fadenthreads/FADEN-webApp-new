export function formatCurrency(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatCount(count) {
  return new Intl.NumberFormat("en-IN").format(count);
}

export function formatISTDateTime(isoString) {
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
  return `${formatted} IST`;
}

export function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMinutes < 60) {
    if (diffMinutes < 1) return "Just now";
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  if (diffDays < 7) {
    return diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
  }
  return formatISTDateTime(isoString);
}

export function formatTimeRange(days) {
  if (days === 1) return "Last 24 hours (IST)";
  return `Last ${days} days (IST)`;
}
