import type { Metadata } from "next";
export const siteOrigins = [
  "https://hugojava.dev",
  "https://hugodotnet.dev",
] as const;
export const sitemapOrigin = siteOrigins[0];
export const siteTitle = "Hugo — Entre código e caos";
export const siteDescription =
  "Vitor Hugo. Full-stack developer: Java, Spring, C#, .NET. Produtos, apps Android e experimentos.";
// The same image is shared across both hosts; no canonical or og:url overrides
// the URL being shared. Absolute image URLs work with social preview crawlers.
export const previewImage = {
  url: `${sitemapOrigin}/hugo-preview.png`,
  width: 1200,
  height: 630,
  alt: "Hugo — Entre código e caos, com o logo H e ponto vermelho.",
};

export function createPageMetadata(
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "Hugo",
      title,
      description,
      images: [previewImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [previewImage],
    },
  };
}
