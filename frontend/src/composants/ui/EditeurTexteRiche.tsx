"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import UnderlineExtension from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { clsx } from "clsx";
import { requeteApiAvecProgression, type ProgressionTeleversement } from "@/crochets/useApi";
import { EtatTeleversement } from "@/composants/ui/EtatTeleversement";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Columns2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Paintbrush2,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Rows3,
  Strikethrough,
  SubscriptIcon,
  SuperscriptIcon,
  Table2,
  Trash2,
  Undo2,
  Underline,
  Upload,
  FileText,
} from "lucide-react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    taillePolice: {
      definirTaillePolice: (taille: string) => ReturnType;
      reinitialiserTaillePolice: () => ReturnType;
    };
  }
}

const ExtensionTaillePolice = Extension.create({
  name: "taillePolice",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      definirTaillePolice:
        (taille) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: taille }).run(),
      reinitialiserTaillePolice:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

interface EditeurTexteRicheProps {
  valeur: string;
  onChange: (html: string) => void;
  placeholder?: string;
  hauteurMinimale?: string;
  classeRacine?: string;
  classeContenu?: string;
  barreCollante?: boolean;
}

interface BoutonEditeurProps {
  titre: string;
  actif?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

const FAMILLES_POLICE = [
  { valeur: "Inter, system-ui, sans-serif", libelle: "Inter" },
  { valeur: "Georgia, serif", libelle: "Georgia" },
  { valeur: "\"Times New Roman\", serif", libelle: "Times New Roman" },
  { valeur: "Arial, Helvetica, sans-serif", libelle: "Arial" },
  { valeur: "\"Courier New\", monospace", libelle: "Courier New" },
];

const TAILLES_POLICE = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

function normaliserContenuHtml(html: string) {
  const contenu = html.trim();
  if (
    !contenu ||
    contenu === "<br>" ||
    contenu === "<div><br></div>" ||
    contenu === "<p></p>" ||
    contenu === "<p><br></p>"
  ) {
    return "";
  }
  return contenu;
}

function echapperHtml(valeur: string) {
  return valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normaliserCouleur(valeur: string | null | undefined) {
  if (!valeur) return "#0f172a";
  const couleur = valeur.trim().toLowerCase();
  if (couleur.startsWith("#")) return couleur;
  const correspondanceRgb = couleur.match(/rgb[a]?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!correspondanceRgb) return "#0f172a";
  return `#${[1, 2, 3]
    .map((index) => Number(correspondanceRgb[index]).toString(16).padStart(2, "0"))
    .join("")}`;
}

function htmlSembleProvenirDeWord(html: string) {
  return /class="?Mso|style="[^"]*mso-|urn:schemas-microsoft-com|w:WordDocument/i.test(html || "");
}

function normaliserHtmlColle(html: string) {
  const documentHtml = new DOMParser().parseFromString(html, "text/html");
  documentHtml.querySelectorAll("script, style, meta, link, xml").forEach((element) => element.remove());
  documentHtml.querySelectorAll("*").forEach((element) => {
    if (element.tagName.toLowerCase() === "o:p") {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    const classes = (element.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean)
      .filter((classe) => !classe.toLowerCase().startsWith("mso"));
    if (classes.length > 0) {
      element.setAttribute("class", classes.join(" "));
    } else {
      element.removeAttribute("class");
    }
    Array.from(element.attributes).forEach((attribut) => {
      if (attribut.name.startsWith("xmlns") || attribut.name === "lang") {
        element.removeAttribute(attribut.name);
      }
    });
  });
  return documentHtml.body.innerHTML;
}

function convertirDataUrlEnFichier(dataUrl: string, nom: string) {
  const [entete, contenuBase64] = dataUrl.split(",");
  const mime = entete.match(/data:([^;]+);base64/i)?.[1] || "image/png";
  const contenuBinaire = atob(contenuBase64 || "");
  const octets = new Uint8Array(contenuBinaire.length);
  for (let index = 0; index < contenuBinaire.length; index += 1) {
    octets[index] = contenuBinaire.charCodeAt(index);
  }
  const extension = mime.split("/")[1] || "png";
  return new File([octets], `${nom}.${extension}`, { type: mime });
}

function BoutonEditeur({ titre, actif = false, disabled = false, onClick, children }: BoutonEditeurProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titre}
      className={clsx(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        actif
          ? "border-primaire-200 bg-primaire-50 text-primaire-700"
          : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      )}
    >
      {children}
    </button>
  );
}

function appliquerStyleBloc(editeur: Editor | null, valeur: string) {
  if (!editeur) return;
  const chaine = editeur.chain().focus();
  switch (valeur) {
    case "heading-1":
      chaine.toggleHeading({ level: 1 }).run();
      return;
    case "heading-2":
      chaine.toggleHeading({ level: 2 }).run();
      return;
    case "heading-3":
      chaine.toggleHeading({ level: 3 }).run();
      return;
    default:
      chaine.setParagraph().run();
  }
}

export function EditeurTexteRiche({
  valeur,
  onChange,
  placeholder = "Rédigez votre contenu…",
  hauteurMinimale = "min-h-[320px]",
  classeRacine,
  classeContenu,
  barreCollante = false,
}: EditeurTexteRicheProps) {
  const [progressionTeleversement, setProgressionTeleversement] = useState<ProgressionTeleversement | null>(null);
  const [libelleTeleversement, setLibelleTeleversement] = useState("Téléversement en cours");
  const inputImagesRef = useRef<HTMLInputElement | null>(null);
  const inputWordRef = useRef<HTMLInputElement | null>(null);

  async function televerserImage(fichier: File, libelle: string) {
    const formData = new FormData();
    formData.append("fichier", fichier);
    setLibelleTeleversement(libelle);
    const reponse = await requeteApiAvecProgression<{ url: string }>(
      "/api/pieces-ecrites/editeur/televersement-image/",
      {
        method: "POST",
        corps: formData,
        onProgression: setProgressionTeleversement,
      }
    );
    return reponse.url;
  }

  async function televerserPlusieursImages(fichiers: File[], libelle: string) {
    const urls: string[] = [];
    for (const [index, fichier] of fichiers.entries()) {
      const url = await televerserImage(
        fichier,
        `${libelle} ${fichiers.length > 1 ? `${index + 1}/${fichiers.length}` : ""}`.trim()
      );
      urls.push(url);
    }
    return urls;
  }

  function insererContenuHtml(editeurActif: Editor, html: string, position?: number) {
    if (typeof position === "number") {
      editeurActif.chain().focus().insertContentAt(position, html).run();
      return;
    }
    editeurActif.chain().focus().insertContent(html).run();
  }

  async function insererImagesDepuisFichiers(fichiers: File[], position?: number, libelle = "Insertion d'image") {
    if (!editeur || fichiers.length === 0) return;
    try {
      const urls = await televerserPlusieursImages(fichiers, libelle);
      const html = urls
        .map((url) => `<p><img src="${echapperHtml(url)}" alt="Image insérée" /></p>`)
        .join("");
      insererContenuHtml(editeur, `${html}<p></p>`, position);
    } finally {
      setTimeout(() => setProgressionTeleversement(null), 500);
    }
  }

  async function remplacerImagesDansHtml(html: string, fichiersPressePapier: File[], libelle: string) {
    const documentHtml = new DOMParser().parseFromString(html, "text/html");
    const images = Array.from(documentHtml.querySelectorAll("img"));
    const fichiers: File[] = [...fichiersPressePapier];

    images.forEach((image, index) => {
      const source = image.getAttribute("src") || "";
      if (source.startsWith("data:image/")) {
        fichiers.push(convertirDataUrlEnFichier(source, `image-collee-${index + 1}`));
      }
    });

    const urls = fichiers.length > 0 ? await televerserPlusieursImages(fichiers, libelle) : [];
    let indexUrl = 0;

    images.forEach((image) => {
      const source = image.getAttribute("src") || "";
      const estImageLocale = !source || source.startsWith("data:image/") || source.startsWith("file:") || source.startsWith("cid:");
      if (!estImageLocale) return;
      const url = urls[indexUrl];
      if (url) {
        image.setAttribute("src", url);
        indexUrl += 1;
      } else {
        image.remove();
      }
    });

    if (indexUrl < urls.length) {
      const corps = documentHtml.body;
      urls.slice(indexUrl).forEach((url) => {
        const paragraphe = documentHtml.createElement("p");
        const image = documentHtml.createElement("img");
        image.setAttribute("src", url);
        image.setAttribute("alt", "Image importée");
        paragraphe.appendChild(image);
        corps.appendChild(paragraphe);
      });
    }

    return documentHtml.body.innerHTML;
  }

  const editeur = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      UnderlineExtension,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      FontFamily,
      ExtensionTaillePolice,
      Subscript,
      Superscript,
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
    ],
    content: valeur || "<p></p>",
    editorProps: {
      attributes: {
        class: clsx(
          "webmail-editeur px-4 py-4 focus:outline-none",
          hauteurMinimale,
          classeContenu
        ),
      },
      handlePaste: (_view, event) => {
        if (!editeur) return false;
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const html = clipboardData.getData("text/html") || "";
        const images = Array.from(clipboardData.files || []).filter((fichier) => fichier.type.startsWith("image/"));
        const doitIntercepter = images.length > 0 || htmlSembleProvenirDeWord(html) || /<img/i.test(html);

        if (!doitIntercepter) return false;

        event.preventDefault();
        const position = editeur.state.selection.from;
        void (async () => {
          try {
            const htmlNormalise = html ? normaliserHtmlColle(html) : "";
            if (htmlNormalise) {
              const htmlAvecImages = await remplacerImagesDansHtml(
                htmlNormalise,
                images,
                "Import du collage Word"
              );
              insererContenuHtml(editeur, htmlAvecImages, position);
            } else if (images.length > 0) {
              await insererImagesDepuisFichiers(images, position, "Collage d'image");
            }
          } finally {
            setTimeout(() => setProgressionTeleversement(null), 500);
          }
        })();
        return true;
      },
      handleDrop: (_view, event) => {
        if (!editeur || !event.dataTransfer) return false;
        const images = Array.from(event.dataTransfer.files || []).filter((fichier) => fichier.type.startsWith("image/"));
        if (images.length === 0) return false;
        event.preventDefault();
        const position = editeur.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insererImagesDepuisFichiers(images, position, "Glisser-déposer d'image");
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : normaliserContenuHtml(editor.getHTML()));
    },
  });

  const etatBarre = useEditorState({
    editor: editeur,
    selector: ({ editor }) => ({
      actifParagraphe: editor?.isActive("paragraph") ?? false,
      actifH1: editor?.isActive("heading", { level: 1 }) ?? false,
      actifH2: editor?.isActive("heading", { level: 2 }) ?? false,
      actifH3: editor?.isActive("heading", { level: 3 }) ?? false,
      police: (editor?.getAttributes("textStyle").fontFamily as string | undefined) || "",
      taille: (editor?.getAttributes("textStyle").fontSize as string | undefined) || "16px",
      couleur: normaliserCouleur(editor?.getAttributes("textStyle").color as string | undefined),
    }),
  }) ?? {
    actifParagraphe: false,
    actifH1: false,
    actifH2: false,
    actifH3: false,
    police: "",
    taille: "16px",
    couleur: "#0f172a",
  };

  useEffect(() => {
    if (!editeur) return;
    const htmlActuel = editeur.isEmpty ? "" : normaliserContenuHtml(editeur.getHTML());
    const htmlAttendu = normaliserContenuHtml(valeur);
    if (htmlActuel !== htmlAttendu) {
      editeur.commands.setContent(valeur || "<p></p>", { emitUpdate: false });
    }
  }, [editeur, valeur]);

  const appliquerLien = () => {
    if (!editeur) return;
    const precedent = editeur.getAttributes("link").href as string | undefined;
    const url = window.prompt("Adresse du lien", precedent || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editeur.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editeur.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const effacerMiseEnForme = () => {
    if (!editeur) return;
    editeur.chain().focus().clearNodes().unsetAllMarks().run();
  };

  const importerDocumentWord = async (fichier: File) => {
    if (!editeur) return;
    const formData = new FormData();
    formData.append("fichier", fichier);
    setLibelleTeleversement("Import du document Word");
    try {
      const reponse = await requeteApiAvecProgression<{ html: string }>(
        "/api/pieces-ecrites/editeur/importer-word/",
        {
          method: "POST",
          corps: formData,
          onProgression: setProgressionTeleversement,
        }
      );
      if (reponse.html) {
        insererContenuHtml(editeur, reponse.html, editeur.state.selection.from);
      }
    } finally {
      setTimeout(() => setProgressionTeleversement(null), 500);
    }
  };

  const styleBlocActif = etatBarre.actifH1
    ? "heading-1"
    : etatBarre.actifH2
      ? "heading-2"
      : etatBarre.actifH3
        ? "heading-3"
        : "paragraph";

  return (
    <div className={clsx("overflow-hidden rounded-2xl border border-slate-200 bg-white", classeRacine)}>
      <div
        className={clsx(
          "space-y-2 border-b border-slate-200 bg-slate-50 px-3 py-3",
          barreCollante && "sticky top-0 z-10 shadow-sm"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="champ-saisie h-9 min-w-[10rem] py-0 text-sm"
            value={styleBlocActif}
            onChange={(event) => appliquerStyleBloc(editeur, event.target.value)}
          >
            <option value="paragraph">Paragraphe</option>
            <option value="heading-1">Titre 1</option>
            <option value="heading-2">Titre 2</option>
            <option value="heading-3">Titre 3</option>
          </select>

          <select
            className="champ-saisie h-9 min-w-[10rem] py-0 text-sm"
            value={etatBarre.police}
            onChange={(event) => {
              if (!editeur) return;
              const valeurPolice = event.target.value;
              if (!valeurPolice) {
                editeur.chain().focus().unsetFontFamily().run();
                return;
              }
              editeur.chain().focus().setFontFamily(valeurPolice).run();
            }}
          >
            <option value="">Police par défaut</option>
            {FAMILLES_POLICE.map((police) => (
              <option key={police.valeur} value={police.valeur}>
                {police.libelle}
              </option>
            ))}
          </select>

          <select
            className="champ-saisie h-9 min-w-[6.5rem] py-0 text-sm"
            value={etatBarre.taille}
            onChange={(event) => editeur?.chain().focus().definirTaillePolice(event.target.value).run()}
          >
            {TAILLES_POLICE.map((taille) => (
              <option key={taille} value={taille}>
                {taille}
              </option>
            ))}
          </select>

          <label className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600">
            <Paintbrush2 size={14} />
            <input
              type="color"
              className="h-5 w-8 cursor-pointer border-0 bg-transparent p-0"
              value={etatBarre.couleur}
              onChange={(event) => editeur?.chain().focus().setColor(event.target.value).run()}
              aria-label="Couleur du texte"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BoutonEditeur
            titre="Annuler"
            onClick={() => editeur?.chain().focus().undo().run()}
            disabled={!editeur?.can().chain().focus().undo().run()}
          >
            <Undo2 size={14} />
          </BoutonEditeur>
          <BoutonEditeur
            titre="Rétablir"
            onClick={() => editeur?.chain().focus().redo().run()}
            disabled={!editeur?.can().chain().focus().redo().run()}
          >
            <Redo2 size={14} />
          </BoutonEditeur>
          <div className="h-6 w-px bg-slate-200" />

          <BoutonEditeur titre="Paragraphe" actif={etatBarre.actifParagraphe} onClick={() => editeur?.chain().focus().setParagraph().run()}>
            <Pilcrow size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Titre 1" actif={etatBarre.actifH1} onClick={() => editeur?.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Titre 2" actif={etatBarre.actifH2} onClick={() => editeur?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Titre 3" actif={etatBarre.actifH3} onClick={() => editeur?.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={14} />
          </BoutonEditeur>
          <div className="h-6 w-px bg-slate-200" />

          <BoutonEditeur titre="Gras" actif={editeur?.isActive("bold")} onClick={() => editeur?.chain().focus().toggleBold().run()}>
            <Bold size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Italique" actif={editeur?.isActive("italic")} onClick={() => editeur?.chain().focus().toggleItalic().run()}>
            <Italic size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Souligné" actif={editeur?.isActive("underline")} onClick={() => editeur?.chain().focus().toggleUnderline().run()}>
            <Underline size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Barré" actif={editeur?.isActive("strike")} onClick={() => editeur?.chain().focus().toggleStrike().run()}>
            <Strikethrough size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Surlignage" actif={editeur?.isActive("highlight")} onClick={() => editeur?.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}>
            <Highlighter size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Indice" actif={editeur?.isActive("subscript")} onClick={() => editeur?.chain().focus().toggleSubscript().run()}>
            <SubscriptIcon size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Exposant" actif={editeur?.isActive("superscript")} onClick={() => editeur?.chain().focus().toggleSuperscript().run()}>
            <SuperscriptIcon size={14} />
          </BoutonEditeur>
          <div className="h-6 w-px bg-slate-200" />

          <BoutonEditeur titre="Liste à puces" actif={editeur?.isActive("bulletList")} onClick={() => editeur?.chain().focus().toggleBulletList().run()}>
            <List size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Liste numérotée" actif={editeur?.isActive("orderedList")} onClick={() => editeur?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Liste de tâches" actif={editeur?.isActive("taskList")} onClick={() => editeur?.chain().focus().toggleTaskList().run()}>
            <ListChecks size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Citation" actif={editeur?.isActive("blockquote")} onClick={() => editeur?.chain().focus().toggleBlockquote().run()}>
            <Quote size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Bloc de code" actif={editeur?.isActive("codeBlock")} onClick={() => editeur?.chain().focus().toggleCodeBlock().run()}>
            <Code2 size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Séparateur" onClick={() => editeur?.chain().focus().setHorizontalRule().run()}>
            <Minus size={14} />
          </BoutonEditeur>
          <div className="h-6 w-px bg-slate-200" />

          <BoutonEditeur titre="Lien" actif={editeur?.isActive("link")} onClick={appliquerLien}>
            <Link2 size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Téléverser une image" onClick={() => inputImagesRef.current?.click()}>
            <Upload size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Importer un fichier Word" onClick={() => inputWordRef.current?.click()}>
            <FileText size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Image distante" onClick={() => {
            if (!editeur) return;
            const url = window.prompt("Adresse de l'image", "https://");
            if (!url || !url.trim()) return;
            editeur.chain().focus().setImage({ src: url.trim() }).run();
          }}>
            <ImagePlus size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Insérer un tableau" onClick={() => editeur?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table2 size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Ajouter une ligne" onClick={() => editeur?.chain().focus().addRowAfter().run()}>
            <Rows3 size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Ajouter une colonne" onClick={() => editeur?.chain().focus().addColumnAfter().run()}>
            <Columns2 size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Supprimer le tableau" onClick={() => editeur?.chain().focus().deleteTable().run()}>
            <Trash2 size={14} />
          </BoutonEditeur>
          <div className="h-6 w-px bg-slate-200" />

          <BoutonEditeur titre="Aligner à gauche" actif={editeur?.isActive({ textAlign: "left" })} onClick={() => editeur?.chain().focus().setTextAlign("left").run()}>
            <AlignLeft size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Centrer" actif={editeur?.isActive({ textAlign: "center" })} onClick={() => editeur?.chain().focus().setTextAlign("center").run()}>
            <AlignCenter size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Aligner à droite" actif={editeur?.isActive({ textAlign: "right" })} onClick={() => editeur?.chain().focus().setTextAlign("right").run()}>
            <AlignRight size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Justifier" actif={editeur?.isActive({ textAlign: "justify" })} onClick={() => editeur?.chain().focus().setTextAlign("justify").run()}>
            <AlignJustify size={14} />
          </BoutonEditeur>
          <BoutonEditeur titre="Effacer la mise en forme" onClick={effacerMiseEnForme}>
            <RemoveFormatting size={14} />
          </BoutonEditeur>
        </div>
      </div>

      <input
        ref={inputImagesRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const fichiers = Array.from(event.target.files || []);
          if (fichiers.length > 0) {
            void insererImagesDepuisFichiers(fichiers, editeur?.state.selection.from, "Téléversement d'image");
          }
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={inputWordRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(event) => {
          const fichier = event.target.files?.[0];
          if (fichier) {
            void importerDocumentWord(fichier);
          }
          event.currentTarget.value = "";
        }}
      />
      <div className="px-3 pt-3">
        <EtatTeleversement progression={progressionTeleversement} libelle={libelleTeleversement} />
      </div>
      <EditorContent editor={editeur} />
    </div>
  );
}
