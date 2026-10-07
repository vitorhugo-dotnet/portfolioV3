import type { Metadata } from "next";
import {
  DocumentLayout,
  DocumentSection,
} from "../../../components/document-layout";
import { createPageMetadata } from "../../../lib/site-config";
export const metadata: Metadata = createPageMetadata(
  "The Universe Decides — Privacy Policy | Hugo",
  "Read how The Universe Decides handles data, permissions, retention and privacy requests.",
);
export default function PrivacyPolicy() {
  return (
    <DocumentLayout application="The Universe Decides" updated="2026-07-16">
      <DocumentSection title="Overview">
        <p>
          This Privacy Policy applies to The Universe Decides, package name
          <span> com.hugo.theuniversedecides</span>, published by Vitor Hugo
          Alves Ferreira. The app is a decision utility that lets users flip a
          coin, roll dice, draw cards, draw tarot cards, and choose an item from
          a custom list.
        </p>
        <p>
          The app is designed to work without user accounts, advertising SDKs,
          analytics SDKs, purchases, or server-side user profiles.
        </p>
      </DocumentSection>

      <DocumentSection title="Data collection">
        <p>
          The app does not ask users to create an account and does not
          intentionally collect names, email addresses, phone numbers, location,
          contacts, photos, messages, payment information, health information,
          advertising identifiers, or other personal profile data.
        </p>
        <p>
          Custom list options typed inside the app are processed locally on the
          device for the current decision flow. They are not uploaded by the app
          to the developer, stored on a developer server, sold, or used for
          advertising.
        </p>
      </DocumentSection>

      <DocumentSection title="Network usage">
        <p>
          The app uses an internet connection for the following functionality:
        </p>
        <ul>
          <li>
            Random.org may be contacted over HTTPS to request random integers.
            The request contains generation parameters such as quantity,
            minimum, and maximum values. If Random.org is unavailable, the app
            falls back to local randomness on the device.
          </li>
          <li>
            GitHub API may be contacted over HTTPS on the About screen to load
            the developer's public GitHub profile and avatar.
          </li>
          <li>
            The Buy Me a Coffee website may be opened when the user voluntarily
            chooses to support the project. Opening this external service is not
            required to use any app feature.
          </li>
        </ul>
        <p>
          Like any internet request, these third-party services may receive
          standard technical request metadata, such as IP address, user-agent,
          timestamps, or similar connection data according to their own
          policies. The app does not add advertising identifiers, analytics
          identifiers, or user account identifiers to these requests.
        </p>
      </DocumentSection>

      <DocumentSection title="Optional project support">
        <p>
          The app includes an optional link to the external Buy Me a Coffee
          service. Contributions are voluntary and do not unlock digital
          content, remove restrictions, or provide additional app functionality.
        </p>
        <p>
          Payments and any personal or payment information entered on Buy Me a
          Coffee are processed by Buy Me a Coffee and its payment providers
          under their own terms and privacy policies. The app does not process
          payments or receive payment card details. Depending on the information
          supplied by the supporter and the external service settings, Buy Me a
          Coffee may make limited supporter details available to the developer.
        </p>
      </DocumentSection>

      <DocumentSection title="Sharing and selling data">
        <p>
          The developer does not sell user data. The developer does not share
          personal or sensitive user data with advertisers, data brokers, or
          marketing platforms. The app does not include ads.
        </p>
      </DocumentSection>

      <DocumentSection title="Permissions">
        <p>
          On Android, the app requests internet access to reach Random.org and
          GitHub API. It also exposes Quick Settings tile services for coin and
          dice shortcuts. These shortcuts are used only to open the app directly
          into the selected action.
        </p>
      </DocumentSection>

      <DocumentSection title="Retention and deletion">
        <p>
          The app does not create user accounts and does not store personal user
          data on developer-controlled servers. Since the app does not maintain
          server-side user profiles, there is no app account to delete. Users
          may clear local app data through the Android system settings at any
          time.
        </p>
        <p>
          Privacy questions or deletion-related requests can be sent to
          <a href="mailto:vitorhugoalvesferreira@gmail.com">
            vitorhugoalvesferreira@gmail.com
          </a>
          .
        </p>
      </DocumentSection>

      <DocumentSection title="Children">
        <p>
          The app is not directed specifically to children. It does not
          knowingly collect personal information from children.
        </p>
      </DocumentSection>

      <DocumentSection title="Changes">
        <p>
          This policy may be updated when the app changes how it handles data,
          permissions, third-party services, or platform requirements. The
          latest version will be published on this page.
        </p>
      </DocumentSection>
    </DocumentLayout>
  );
}
