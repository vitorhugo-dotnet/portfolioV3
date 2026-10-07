export type HubResource = {
  application: string;
  title: string;
  description: string;
  href: string;
};
export const hubResources: readonly HubResource[] = [
  {
    application: "SonicRelay",
    title: "Privacy Policy",
    description:
      "Read how SonicRelay handles device, pairing, and connection data.",
    href: "/sonicrelay/privacy-policy",
  },
  {
    application: "The Universe Decides",
    title: "Privacy Policy",
    description:
      "Read how The Universe Decides handles data and external services.",
    href: "/the-universe-decides/privacy-policy",
  },
];
