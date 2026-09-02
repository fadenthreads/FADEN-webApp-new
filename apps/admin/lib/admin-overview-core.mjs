export function getReadinessPresentation(readiness) {
  if (readiness.live) {
    return {
      label: "Live",
      modifier: "live",
      message: "Operational",
      icon: "check_circle",
    };
  }
  if (readiness.enabled) {
    return {
      label: "Enabled",
      modifier: "enabled",
      message: "Enabled but live workflows disabled",
      icon: "info",
    };
  }
  if (readiness.configured) {
    return {
      label: "Configured",
      modifier: "configured",
      message: "Configured but not enabled",
      icon: "info",
    };
  }
  return {
    label: "Not configured",
    modifier: "missing",
    message: "Missing required configuration",
    icon: "warning",
  };
}
