"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type TypeNotification = "succes" | "erreur" | "alerte" | "info";

interface Notification {
  id: string;
  type: TypeNotification;
  message: string;
  duree: number;
}

interface ContexteNotifications {
  notifier: (type: TypeNotification, message: string, duree?: number) => void;
  succes: (message: string) => void;
  erreur: (message: string) => void;
  alerte: (message: string) => void;
  info: (message: string) => void;
}

const ContexteNotif = createContext<ContexteNotifications | null>(null);

const CONFIG_TYPE: Record<TypeNotification, {
  icone: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  couleurIcone: string;
  barreColor: string;
}> = {
  succes: { icone: CheckCircle,    couleurIcone: "#16a34a", barreColor: "#16a34a" },
  erreur: { icone: XCircle,        couleurIcone: "#dc2626", barreColor: "#dc2626" },
  alerte: { icone: AlertTriangle,  couleurIcone: "#d97706", barreColor: "#d97706" },
  info:   { icone: Info,           couleurIcone: "#0284c7", barreColor: "#0284c7" },
};

export function FournisseurNotifications({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const retirer = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notifier = useCallback(
    (type: TypeNotification, message: string, duree = 4500) => {
      const id = `notif-${Date.now()}-${Math.random()}`;
      setNotifications((prev) => [...prev.slice(-4), { id, type, message, duree }]);
      setTimeout(() => retirer(id), duree);
    },
    [retirer]
  );

  const succes = useCallback((m: string) => notifier("succes", m), [notifier]);
  const erreur = useCallback((m: string) => notifier("erreur", m, 6000), [notifier]);
  const alerte = useCallback((m: string) => notifier("alerte", m), [notifier]);
  const info   = useCallback((m: string) => notifier("info",   m), [notifier]);

  return (
    <ContexteNotif.Provider value={{ notifier, succes, erreur, alerte, info }}>
      {children}

      {/* Zone toasts — coin inférieur droit */}
      <div
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
        style={{ width: "22rem", maxWidth: "calc(100vw - 2rem)" }}
        aria-live="polite"
        aria-label="Notifications"
      >
        {notifications.map((notif) => {
          const { icone: Icone, couleurIcone, barreColor } = CONFIG_TYPE[notif.type];
          return (
            <div key={notif.id} className="toast relative overflow-hidden">
              <Icone size={18} className="shrink-0 mt-0.5" color={couleurIcone} />
              <p className="flex-1 text-sm leading-snug" style={{ color: "var(--texte)" }}>
                {notif.message}
              </p>
              <button
                onClick={() => retirer(notif.id)}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded transition-colors"
                style={{ color: "var(--texte-3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fond-app)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                aria-label="Fermer"
              >
                <X size={13} />
              </button>

              {/* Barre de progression */}
              <div
                className="absolute bottom-0 left-0 h-0.5"
                style={{
                  background: barreColor,
                  animation: `barre-progression ${notif.duree}ms linear forwards`,
                }}
              />
            </div>
          );
        })}
      </div>
    </ContexteNotif.Provider>
  );
}

export function useNotifications(): ContexteNotifications {
  const ctx = useContext(ContexteNotif);
  if (!ctx) throw new Error("useNotifications doit être utilisé dans FournisseurNotifications");
  return ctx;
}
