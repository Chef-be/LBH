"use client";

import { useEffect, useRef } from "react";

export interface TacheGanttFrappe {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies?: string;
  custom_class?: string;
}

interface Props {
  taches: TacheGanttFrappe[];
  viewMode?: "Day" | "Week" | "Month" | "Quarter Year" | "Year";
  onDateChange?: (tache: TacheGanttFrappe, debut: Date, fin: Date) => void;
  onProgressChange?: (tache: TacheGanttFrappe, progression: number) => void;
  onTaskClick?: (tache: TacheGanttFrappe) => void;
  hauteurMin?: number;
}

export default function GanttFrappe({
  taches,
  viewMode = "Month",
  onDateChange,
  onProgressChange,
  onTaskClick,
  hauteurMin = 340,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || taches.length === 0) return;

    let cancelled = false;

    if (!document.getElementById("frappe-gantt-css")) {
      const link = document.createElement("link");
      link.id = "frappe-gantt-css";
      link.rel = "stylesheet";
      link.href = "/frappe-gantt.css";
      document.head.appendChild(link);
    }

    import("frappe-gantt").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const Gantt = mod.default;

      containerRef.current.innerHTML = "";

      new Gantt(containerRef.current, taches as import("frappe-gantt").GanttTask[], {
        view_mode: viewMode,
        language: "fr",
        bar_height: 28,
        bar_corner_radius: 4,
        arrow_curve: 5,
        padding: 16,
        date_format: "YYYY-MM-DD",
        scroll_to: "today",
        on_date_change: onDateChange
          ? (task: TacheGanttFrappe, start: Date, end: Date) => onDateChange(task, start, end)
          : undefined,
        on_progress_change: onProgressChange
          ? (task: TacheGanttFrappe, progress: number) => onProgressChange(task, progress)
          : undefined,
        on_click: onTaskClick
          ? (task: TacheGanttFrappe) => onTaskClick(task)
          : undefined,
      });

      // Traduire "Today" → "Aujourd'hui"
      requestAnimationFrame(() => {
        containerRef.current?.querySelectorAll(".today-button").forEach((btn) => {
          if (btn.textContent === "Today") btn.textContent = "Aujourd'hui";
        });
      });
    });

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [taches, viewMode, onDateChange, onProgressChange, onTaskClick]);

  if (taches.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--texte-3)] text-sm">
        Aucune tâche à afficher — importez depuis le DPGF ou ajoutez une tâche libre.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="gantt-frappe-container w-full"
      style={{ minHeight: hauteurMin, maxHeight: 600 }}
    />
  );
}
