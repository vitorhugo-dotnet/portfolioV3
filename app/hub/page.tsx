import type { Metadata } from "next";
import Link from "next/link";
import { ResourceShell } from "../../components/document-layout";
import { hubResources } from "../../components/hub-resources";
export const metadata: Metadata = {
  title: "Hub — App resources | Hugo",
  description:
    "Public documents and privacy resources for SonicRelay, The Universe Decides and published apps by Vitor Hugo.",
};
export default function Hub() {
  return (
    <ResourceShell>
      <section className="hub" lang="en">
        <div className="section-label">
          <span>HUB / PUBLIC RESOURCES</span>
          <span>HUGO.DEV ↙</span>
        </div>
        <h1>
          Apps. Documents.
          <br />
          <em>One place.</em>
        </h1>
        <p className="intro">Privacy resources for published apps.</p>
        <div className="hub-resources">
          {hubResources.map((resource) => (
            <Link className="hub-card" key={resource.href} href={resource.href}>
              <span className="tag">{resource.application}</span>
              <h2>
                {resource.title} <span aria-hidden="true">↗</span>
              </h2>
              <p>{resource.description}</p>
              <span className="resource-open">Read document →</span>
            </Link>
          ))}
        </div>
      </section>
    </ResourceShell>
  );
}
