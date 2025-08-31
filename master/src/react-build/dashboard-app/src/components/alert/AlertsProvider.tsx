// src/components/alerts/AlertsProvider.tsx
import { Toaster, toast } from "react-hot-toast";
import { useEffect } from "react";
import { useAlertStore } from "../store/alertStore";

export default function AlertsProvider() {
  const alerts = useAlertStore((s) => s.alerts);

  // show toasts when a new alert arrives
  useEffect(() => {
    if (alerts.length === 0) return;
    const latest = alerts[0];
    const method = {
      info: toast,
      success: toast.success,
      warning: toast,
      error: toast.error,
    }[latest.severity ?? "info"];
    method(`${latest.title}${latest.message ? ` — ${latest.message}` : ""}`, {
      id: latest.id,
      duration: 12_000,
    });
  }, [alerts]);

  return <Toaster position="top-right" />;
}
