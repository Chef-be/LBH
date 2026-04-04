import type { NextConfig } from "next";

const prefixeConteneurs = (
  process.env.PREFIXE_CONTENEURS ||
  process.env.NEXT_PUBLIC_PREFIXE ||
  "lbh"
).trim() || "lbh";

const urlBackend = process.env.URL_BACKEND || `http://${prefixeConteneurs}-backend:8000`;

const hoteBackend = (() => {
  try {
    return new URL(urlBackend).hostname;
  } catch {
    return `${prefixeConteneurs}-backend`;
  }
})();

const hotesImagesInternes = Array.from(
  new Set(["localhost", "127.0.0.1", hoteBackend, `${prefixeConteneurs}-frontend`]),
);

const configurationNext: NextConfig = {
  output: "standalone",
  reactStrictMode: true,

  // Réécriture des requêtes API vers le backend Django
  async rewrites() {
    return [
      {
        source: "/api/:chemin*",
        destination: `${urlBackend}/api/:chemin*`,
      },
    ];
  },

  // En-têtes de sécurité
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },

  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      ...hotesImagesInternes.map((hostname) => ({
        protocol: "http" as const,
        hostname,
      })),
      {
        protocol: "https",
        hostname: "**.lbh-economiste.com",
      },
      {
        protocol: "http",
        hostname: "**.lbh-economiste.com",
      },
    ],
  },
};

export default configurationNext;
