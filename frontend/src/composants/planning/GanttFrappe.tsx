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
  hauteur?: number;
}

export default function GanttFrappe({
  taches,
  viewMode = "Month",
  onDateChange,
  onProgressChange,
  onTaskClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<unknown>(null);

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
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      containerRef.current.appendChild(svg);

      ganttRef.current = new Gantt(svg, taches as import("frappe-gantt").GanttTask[], {
        view_mode: viewMode,
        language: "fr",
        bar_height: 26,
        bar_corner_radius: 4,
        arrow_curve: 5,
        padding: 14,
        date_format: "YYYY-MM-DD",
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
    });

    return () => {
      cancelled = true;
    };
  }, [taches, viewMode, onDateChange, onProgressChange, onTaskClick]);

  if (taches.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gris-400 text-sm">
        Aucune tâche à afficher
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="gantt-frappe-container w-full overflow-x-auto"
      style={{ minHeight: 200 }}
    />
  );
}
