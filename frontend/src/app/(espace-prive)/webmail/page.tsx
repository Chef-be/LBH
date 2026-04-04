"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";

import { api } from "@/crochets/useApi";

interface ConfigurationRoundcube {
  product_name: string;
  default_task: string;
}

export default function PageWebmail() {
  const [versionIframe, setVersionIframe] = useState(0);
  const { data } = useQuery<ConfigurationRoundcube>({
    queryKey: ["page-webmail-roundcube-configuration"],
    queryFn: () => api.get<ConfigurationRoundcube>("/api/messagerie/roundcube/configuration/"),
  });

  const tache = data?.default_task || "mail";
  const source = useMemo(
    () => `/roundcube/?_task=${encodeURIComponent(tache)}&v=${versionIframe}`,
    [tache, versionIframe]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex justify-end gap-2">
          <button onClick={() => setVersionIframe((courant) => courant + 1)} className="btn-secondaire">
            <RefreshCw size={14} />
            Recharger
          </button>
          <Link href={source} target="_blank" rel="noopener noreferrer" className="btn-primaire">
            <ExternalLink size={14} />
            Ouvrir seul
          </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border" style={{ borderColor: "var(--bordure)", background: "var(--fond-carte)" }}>
        <iframe
          key={source}
          src={source}
          title={data?.product_name || "Messagerie Roundcube"}
          className="h-full min-h-[72vh] w-full border-0"
        />
      </div>
    </div>
  );
}
