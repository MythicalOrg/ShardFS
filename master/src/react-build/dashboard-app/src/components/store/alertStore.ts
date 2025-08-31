// src/stores/alertStore.ts
import { create } from "zustand";

type AlertSeverity = "info" | "success" | "warning" | "error";
type Alert = {
  id: string;
  title: string;
  message?: string;
  severity?: AlertSeverity;
  timestamp: number;
};

type AlertState = {
  alerts: Alert[];
  push: (a: Omit<Alert, "id" | "timestamp">) => void;
  remove: (id: string) => void;
};

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  push: (a) =>
    set((s) => {
      const id = `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const alert: Alert = { id, timestamp: Date.now(), ...a };
      return { alerts: [alert, ...s.alerts] };
    }),
  remove: (id) => set((s) => ({ alerts: s.alerts.filter((x) => x.id !== id) })),
}));
