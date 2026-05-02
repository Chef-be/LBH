import { NextResponse } from "next/server";

const URL_BACKEND = process.env.URL_BACKEND || "http://lbh-backend:8000";
export const dynamic = "force-dynamic";

export async function GET() {
  const reponse = await fetch(`${URL_BACKEND}/api/site/favicon/`, {
    cache: "force-cache",
  });

  if (!reponse.ok) {
    return new NextResponse(null, { status: 404 });
  }

  const contenu = await reponse.arrayBuffer();
  return new NextResponse(contenu, {
    status: 200,
    headers: {
      "Content-Type": reponse.headers.get("content-type") || "image/svg+xml",
      "Cache-Control": reponse.headers.get("cache-control") || "public, max-age=3600",
    },
  });
}
