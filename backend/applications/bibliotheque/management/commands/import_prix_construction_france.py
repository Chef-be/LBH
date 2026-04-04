import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from applications.bibliotheque.services import (
    _charger_document_html,
    _est_url_fiche_prix,
    _liens_depuis_document,
    _prefixe_descendance,
    importer_referentiel_prix_construction,
    lister_urls_fiches_prix_construction,
)


URLS_FRANCE = [
    "https://prix-construction.info/construction_neuve",
    "https://prix-construction.info/renovation",
    "https://prix-construction.info/espaces_urbains",
]


class Command(BaseCommand):
    help = "Importe l'ensemble du référentiel France de prix-construction.info par lots avec reprise."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=200,
            help="Nombre de fiches à importer par lot.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limite totale de fiches à découvrir/importer.",
        )
        parser.add_argument(
            "--state-file",
            type=str,
            default="",
            help="Chemin du fichier d'état JSON utilisé pour la reprise.",
        )
        parser.add_argument(
            "--discover-only",
            action="store_true",
            help="Découvre les URLs sans lancer l'import.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Ignore et réinitialise l'état existant.",
        )
        parser.add_argument(
            "--no-cctp",
            action="store_true",
            help="N'importe pas les articles CCTP associés.",
        )

    def handle(self, *args, **options):
        state_path = Path(options["state_file"]).expanduser() if options["state_file"] else (
            Path(settings.BASE_DIR) / "var" / "imports" / "prix_construction_france.json"
        )
        state_path.parent.mkdir(parents=True, exist_ok=True)

        batch_size = max(1, int(options["batch_size"]))
        limit = options["limit"]
        create_cctp = not options["no_cctp"]

        state = {} if options["reset"] else self._load_state(state_path)
        if not state:
            state = {
                "roots": URLS_FRANCE,
                "discovered_urls": [],
                "next_index": 0,
                "done": False,
                "totals": {
                    "fiches": 0,
                    "creees": 0,
                    "mises_a_jour": 0,
                    "articles_cctp": 0,
                },
                "discovery": self._initialiser_etat_decouverte(URLS_FRANCE),
            }
        elif "discovery" not in state:
            state["discovery"] = self._initialiser_etat_decouverte(state.get("roots") or URLS_FRANCE)

        if not state["discovery"].get("complete"):
            self.stdout.write("Découverte des URLs France…")
            self._decouvrir_urls_incrementalement(state_path, state, limit=limit)
            self.stdout.write(self.style.SUCCESS(f"{len(state['discovered_urls'])} fiche(s) découverte(s)."))
        elif not state["discovered_urls"] or options["reset"]:
            urls = lister_urls_fiches_prix_construction(URLS_FRANCE, limite=limit)
            state["discovered_urls"] = urls
            state["next_index"] = 0
            state["done"] = False
            state["discovery"] = self._initialiser_etat_decouverte(URLS_FRANCE, complete=True)
            self._save_state(state_path, state)
            self.stdout.write(self.style.SUCCESS(f"{len(urls)} fiche(s) découverte(s)."))
        else:
            self.stdout.write(
                f"Reprise sur {len(state['discovered_urls'])} fiche(s), index {state['next_index']}."
            )

        if options["discover_only"]:
            self.stdout.write(self.style.SUCCESS(f"Découverte terminée. État enregistré dans {state_path}"))
            return

        total = len(state["discovered_urls"])
        next_index = int(state["next_index"])
        if total == 0:
            self.stdout.write(self.style.WARNING("Aucune fiche à importer."))
            return

        while next_index < total:
            batch = state["discovered_urls"][next_index: next_index + batch_size]
            debut = next_index + 1
            fin = next_index + len(batch)
            self.stdout.write(f"Import du lot {debut}-{fin} / {total}…")

            resultat = importer_referentiel_prix_construction(
                urls_depart=batch,
                auteur=None,
                limite=None,
                creer_articles_cctp=create_cctp,
            )

            for key in state["totals"]:
                state["totals"][key] += int(resultat.get(key, 0))

            next_index = fin
            state["next_index"] = next_index
            state["done"] = next_index >= total
            self._save_state(state_path, state)

            self.stdout.write(
                self.style.SUCCESS(
                    f"Lot terminé: {resultat['fiches']} fiche(s), "
                    f"{resultat['creees']} créée(s), "
                    f"{resultat['mises_a_jour']} mise(s) à jour."
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Import France terminé — "
                f"{state['totals']['fiches']} fiche(s), "
                f"{state['totals']['creees']} créée(s), "
                f"{state['totals']['mises_a_jour']} mise(s) à jour, "
                f"{state['totals']['articles_cctp']} article(s) CCTP."
            )
        )
        self.stdout.write(f"État final enregistré dans {state_path}")

    def _load_state(self, path: Path) -> dict:
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def _save_state(self, path: Path, state: dict) -> None:
        path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    def _initialiser_etat_decouverte(self, roots: list[str], complete: bool = False) -> dict:
        return {
            "complete": complete,
            "remaining_roots": list(roots),
            "current_root": None,
            "current_prefix": "",
            "queue": [],
            "visited": [],
            "pages_scanned": 0,
        }

    def _decouvrir_urls_incrementalement(self, state_path: Path, state: dict, limit: int | None = None) -> None:
        discovery = state["discovery"]
        urls = list(state.get("discovered_urls") or [])
        urls_set = set(urls)

        while not discovery.get("complete"):
            if limit is not None and len(urls) >= limit:
                discovery["complete"] = True
                break

            current_root = discovery.get("current_root")
            queue = list(discovery.get("queue") or [])
            visited = set(discovery.get("visited") or [])
            prefix = discovery.get("current_prefix") or ""

            if not current_root:
                remaining_roots = list(discovery.get("remaining_roots") or [])
                if not remaining_roots:
                    discovery["complete"] = True
                    break

                current_root = remaining_roots.pop(0)
                discovery["remaining_roots"] = remaining_roots
                discovery["current_root"] = current_root

                if _est_url_fiche_prix(current_root):
                    if current_root not in urls_set:
                        urls.append(current_root)
                        urls_set.add(current_root)
                    discovery["current_root"] = None
                    self._save_discovery_state(state_path, state, urls, discovery)
                    continue

                prefix = _prefixe_descendance(current_root)
                queue = [current_root]
                visited = set()
                discovery["current_prefix"] = prefix
                discovery["queue"] = queue
                discovery["visited"] = []
                self.stdout.write(f"Exploration de {current_root}…")
                self._save_discovery_state(state_path, state, urls, discovery)

            if not queue:
                discovery["current_root"] = None
                discovery["current_prefix"] = ""
                discovery["queue"] = []
                discovery["visited"] = []
                self._save_discovery_state(state_path, state, urls, discovery)
                continue

            url = queue.pop(0)
            if url in visited:
                discovery["queue"] = queue
                discovery["visited"] = list(visited)
                self._save_discovery_state(state_path, state, urls, discovery)
                continue

            visited.add(url)
            try:
                document = _charger_document_html(url)
            except Exception as exc:
                self.stderr.write(self.style.WARNING(f"Échec découverte {url}: {exc}"))
                discovery["queue"] = queue
                discovery["visited"] = list(visited)
                self._save_discovery_state(state_path, state, urls, discovery)
                continue

            for lien in _liens_depuis_document(document, url):
                if not lien.startswith(prefix):
                    continue
                if _est_url_fiche_prix(lien):
                    if lien not in urls_set:
                        urls.append(lien)
                        urls_set.add(lien)
                        if limit is not None and len(urls) >= limit:
                            discovery["complete"] = True
                            break
                elif lien not in visited and lien not in queue:
                    queue.append(lien)

            discovery["pages_scanned"] = int(discovery.get("pages_scanned") or 0) + 1
            discovery["queue"] = queue
            discovery["visited"] = list(visited)
            self._save_discovery_state(state_path, state, urls, discovery)

            if discovery["pages_scanned"] % 25 == 0:
                self.stdout.write(
                    f"{len(urls)} fiche(s) découverte(s), {discovery['pages_scanned']} page(s) explorée(s)…"
                )

        self._save_discovery_state(state_path, state, urls, discovery)

    def _save_discovery_state(self, state_path: Path, state: dict, urls: list[str], discovery: dict) -> None:
        state["discovered_urls"] = urls
        state["discovery"] = discovery
        self._save_state(state_path, state)
