import type { Metadata } from "next";
import { PortfolioPage } from "../../components/portfolio-page";
import { localizedHomepageMetadata } from "../../lib/site-config";

export const metadata: Metadata = localizedHomepageMetadata("en");

export default function EnglishPage() {
  return <PortfolioPage locale="en" />;
}
