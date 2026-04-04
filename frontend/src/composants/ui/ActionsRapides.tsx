"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

type VarianteAction = "neutre" | "primaire" | "danger";
type TailleAction = "icone" | "menu";

export interface ActionRapideConfig {
  href?: string;
  titre: string;
  icone: LucideIcon;
  variante?: VarianteAction;
  onClick?: () => void;
  disabled?: boolean;
  target?: string;
  rel?: string;
}

function classesAction(variante: VarianteAction, taille: TailleAction = "icone") {
  return clsx(
    taille === "icone" && "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
    taille === "menu" && "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
    variante === "danger" && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    variante === "primaire" && "border-primaire-200 bg-primaire-50 text-primaire-700 hover:bg-primaire-100",
    variante === "neutre" && "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  );
}

export function GroupeActionsRapides({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}

export function LienActionRapide({
  href,
  titre,
  icone: Icone,
  variante = "neutre",
}: {
  href: string;
  titre: string;
  icone: LucideIcon;
  variante?: VarianteAction;
}) {
  return (
    <Link href={href} className={classesAction(variante)} title={titre} aria-label={titre}>
      <Icone className="h-4 w-4" />
    </Link>
  );
}

export function BoutonActionRapide({
  titre,
  icone: Icone,
  onClick,
  disabled = false,
  variante = "neutre",
}: {
  titre: string;
  icone: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variante?: VarianteAction;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(classesAction(variante), "disabled:cursor-not-allowed disabled:opacity-50")}
      title={titre}
      aria-label={titre}
    >
      <Icone className="h-4 w-4" />
    </button>
  );
}

function ActionRapideElement({
  action,
  taille,
  fermerMenu,
}: {
  action: ActionRapideConfig;
  taille: TailleAction;
  fermerMenu?: () => void;
}) {
  const {
    href,
    titre,
    icone: Icone,
    variante = "neutre",
    onClick,
    disabled = false,
    target,
    rel,
  } = action;
  const contenu = (
    <>
      <Icone className="h-4 w-4 shrink-0" />
      {taille === "menu" && <span className="truncate">{titre}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        className={clsx(classesAction(variante, taille), disabled && "pointer-events-none opacity-50")}
        title={titre}
        aria-label={titre}
        onClick={fermerMenu}
      >
        {contenu}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        fermerMenu?.();
        onClick?.();
      }}
      disabled={disabled}
      className={clsx(classesAction(variante, taille), "disabled:cursor-not-allowed disabled:opacity-50")}
      title={titre}
      aria-label={titre}
    >
      {contenu}
    </button>
  );
}

export function ActionsRapidesAdaptatives({
  actions,
}: {
  actions: ActionRapideConfig[];
}) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const menuId = useId();
  const conteneurRef = useRef<HTMLDivElement | null>(null);
  const actionsVisibles = actions.filter((action) => action.href || action.onClick);

  useEffect(() => {
    if (!menuOuvert) return undefined;

    const gererClickExterieur = (event: MouseEvent) => {
      if (conteneurRef.current?.contains(event.target as Node)) return;
      setMenuOuvert(false);
    };

    const gererClavier = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOuvert(false);
      }
    };

    document.addEventListener("mousedown", gererClickExterieur);
    document.addEventListener("keydown", gererClavier);
    return () => {
      document.removeEventListener("mousedown", gererClickExterieur);
      document.removeEventListener("keydown", gererClavier);
    };
  }, [menuOuvert]);

  if (actionsVisibles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden items-center gap-2 sm:flex">
        {actionsVisibles.map((action) => (
          <ActionRapideElement
            key={`${action.titre}-${action.href ?? "action"}`}
            action={action}
            taille="icone"
          />
        ))}
      </div>

      <div ref={conteneurRef} className="relative sm:hidden">
        <button
          type="button"
          className={classesAction("neutre")}
          aria-label="Ouvrir les actions"
          aria-expanded={menuOuvert}
          aria-controls={menuId}
          onClick={() => setMenuOuvert((precedent) => !precedent)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOuvert && (
          <div
            id={menuId}
            className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
          >
            <div className="space-y-1">
              {actionsVisibles.map((action) => (
                <ActionRapideElement
                  key={`${action.titre}-${action.href ?? "action-mobile"}`}
                  action={action}
                  taille="menu"
                  fermerMenu={() => setMenuOuvert(false)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
