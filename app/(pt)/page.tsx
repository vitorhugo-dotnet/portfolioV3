import type { Metadata } from "next";
import { PortfolioPage } from "../../components/portfolio-page";
import { localizedHomepageMetadata } from "../../lib/site-config";

export const metadata: Metadata = localizedHomepageMetadata("pt-BR");

export default function Page() {
  return <PortfolioPage locale="pt-BR" />;
}
