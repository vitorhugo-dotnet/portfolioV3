import type { Metadata } from "next";
export const siteOrigins = [
  "https://hugojava.dev",
  "https://hugodotnet.dev",
] as const;
export const sitemapOrigin = siteOrigins[0];
export const canonicalOrigin = siteOrigins[1];
const javaLinkedInProfile = "https://www.linkedin.com/in/hugo-java/";
const dotnetLinkedInProfile = "https://www.linkedin.com/in/vitorhugo-dotnet/";
export function linkedInProfileForHostname(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "hugojava.dev" || host.endsWith(".hugojava.dev")
    ? javaLinkedInProfile
    : dotnetLinkedInProfile;
}
export const siteTitle = "Hugo — Entre código e caos";
export const siteDescription =
  "Vitor Hugo. Full-stack developer: Java, Spring, C#, .NET. Produtos, apps Android e experimentos.";
// Absolute image URLs work with social preview crawlers on both portfolio hosts.
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

export function localizedHomepageMetadata(locale: "pt-BR" | "en"): Metadata {
  const english = locale === "en";
  const canonical = english ? `${canonicalOrigin}/en` : `${canonicalOrigin}/`;
  const title = english
    ? "Vitor Hugo — Full-Stack Software Engineer | Hugo"
    : "Vitor Hugo — Desenvolvedor Full-Stack | Hugo";
  const description = english
    ? "Vitor Hugo, full-stack software engineer focused on Java, Spring, C#, and .NET. Building products, Android apps, and engineering projects."
    : "Vitor Hugo, desenvolvedor full-stack com foco em Java, Spring, C# e .NET. Produtos, aplicativos Android e projetos de engenharia.";
  const localizedPreviewImage = {
    ...previewImage,
    alt: english
      ? "Hugo portfolio branding with the H logo and red dot."
      : "Portfólio Hugo com a marca H e um ponto vermelho.",
  };
  const languages = {
    "pt-BR": `${canonicalOrigin}/`,
    en: `${canonicalOrigin}/en`,
    "x-default": `${canonicalOrigin}/`,
  };

  return {
    title,
    description,
    alternates: { canonical, languages },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: english ? "en_US" : "pt_BR",
      siteName: "Hugo",
      url: canonical,
      title,
      description,
      images: [localizedPreviewImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [localizedPreviewImage],
    },
  };
}
