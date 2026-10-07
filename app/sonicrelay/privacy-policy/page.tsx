import type { Metadata } from "next";
import {
  DocumentLayout,
  DocumentSection,
} from "../../../components/document-layout";
import { createPageMetadata } from "../../../lib/site-config";
export const metadata: Metadata = createPageMetadata(
  "SonicRelay — Privacy Policy | Hugo",
  "Read how SonicRelay handles data, permissions, retention and privacy requests.",
);
export default function PrivacyPolicy() {
  return (
    <DocumentLayout application="SonicRelay" updated="2026-08-18">
      <DocumentSection title="Overview">
        <p>
          This Privacy Policy applies to SonicRelay, package name
          <span> com.vitorhugo.sonicrelay.sonic_relay</span>, published by Vitor
          Hugo Alves Ferreira. SonicRelay is a mobile viewer for a low-latency
          personal audio streaming suite. It lets you listen to audio streamed
          from your own paired Windows publisher app through a SonicRelay
          backend, WebSocket signaling, and WebRTC media transport.
        </p>
        <p>
          <span>SonicRelay has no user accounts.</span> There is no sign-up, no
          email address, no password, and no profile. Identity belongs to the
          device itself: on first launch the app registers with the backend and
          receives a device identifier and a secret credential. That is the
          whole of what identifies you to the service.
        </p>
        <p>
          The Android app is the viewer. It receives remote audio playback from
          your paired Windows publisher. It does not record the phone
          microphone, does not record video, does not access location, does not
          read contacts, and does not include advertising or analytics SDKs.
        </p>
      </DocumentSection>

      <DocumentSection title="Data collected or processed">
        <p>
          SonicRelay processes device and connection data only to identify
          trusted devices, pair them with each other, join private streaming
          sessions, and operate the real-time connection:
        </p>
        <ul>
          <li>
            A backend-issued <span>device identifier</span>, plus a device
            credential whose secret is stored only on your device. The server
            keeps a keyed hash of that secret and never the secret itself.
          </li>
          <li>
            Short-lived access tokens (minutes) issued against that credential
            and held in the device&apos;s secure storage. There are no
            long-lived refresh tokens.
          </li>
          <li>
            Device registration data: a device name taken from the device model
            or its user-assigned name, device type, platform, and status.
          </li>
          <li>
            Pairing records linking your viewer to your publisher device, and
            short-lived pairing challenges stored only as a keyed hash of the
            code.
          </li>
          <li>
            Session data: session identifiers, participant identifiers, join and
            leave events, connection status, and temporary join codes held only
            as a keyed hash with a short expiry.
          </li>
          <li>
            Optional relay (TURN) preferences you configure, including a custom
            relay address and credentials if you enter them.
          </li>
          <li>
            Server infrastructure receives standard technical metadata such as
            IP address, timestamps, user agent, and request logs.
          </li>
        </ul>
        <p>
          WebRTC signaling carries SDP descriptions and ICE candidates so the
          audio connection can be established. These are relayed between your
          devices in transit, are not stored in the backend database, and are
          excluded from production logs.
        </p>
        <p>
          The app may report connection quality readings (packet loss, jitter,
          round-trip time, selected transport). These are aggregated into
          operational metrics that carry no device or session identifier, and
          are not stored per device.
        </p>
      </DocumentSection>

      <DocumentSection title="Permissions">
        <ul>
          <li>
            <span>Camera</span> — used only to scan the QR code shown by your
            Windows publisher when pairing. The camera preview is not recorded,
            not stored, and not transmitted; only the pairing code read from the
            QR image is used.
          </li>
          <li>
            <span>Internet, network and Wi-Fi state</span> — to reach the
            backend and to detect when connectivity drops so playback can
            recover.
          </li>
          <li>
            <span>Foreground service and media playback</span> — to keep audio
            playing while the app is in the background.
          </li>
          <li>
            <span>Notifications</span> — to show the playback notification
            required for background audio.
          </li>
          <li>
            <span>Wake lock</span> — to keep the stream alive while the screen
            is off.
          </li>
        </ul>
      </DocumentSection>

      <DocumentSection title="Audio handling">
        <p>
          SonicRelay is designed for live audio transport. The Android viewer
          receives and plays a remote audio track from the Windows publisher.
          The Android app does not upload microphone audio from the phone. The
          backend handles device identity, pairing, sessions and signaling only;
          audio flows peer-to-peer when possible, or through a TURN relay when
          the network requires it, and never through the backend API.
        </p>
        <p>
          Live audio streams are not recorded, stored, sold, or used for
          advertising. If a future version adds recording, analytics, crash
          reporting, microphone capture, cloud storage, or any new third-party
          SDK, this policy and the Google Play Data safety form will be updated
          before that version is released.
        </p>
      </DocumentSection>

      <DocumentSection title="How data is used">
        <ul>
          <li>Identify the device and maintain a secure session.</li>
          <li>
            Pair your viewer with your publisher, and let you revoke that
            pairing.
          </li>
          <li>Allow the viewer to join a private streaming session by code.</li>
          <li>
            Route WebSocket signaling messages between authorized participants.
          </li>
          <li>Establish and maintain the WebRTC audio connection.</li>
          <li>
            Protect the service against abuse, invalid sessions, and
            unauthorized access.
          </li>
        </ul>
      </DocumentSection>

      <DocumentSection title="Sharing and selling data">
        <p>
          The developer does not sell personal or sensitive user data.
          SonicRelay does not include advertising SDKs and does not share
          personal data with advertisers or data brokers. Data may be processed
          by infrastructure providers used to host the backend, WebSocket
          signaling, TURN relay, DNS, TLS, logging, or deployment systems, only
          as needed to operate and secure the service.
        </p>
      </DocumentSection>

      <DocumentSection title="Security">
        <ul>
          <li>
            Production API traffic uses HTTPS and WebSocket traffic uses WSS.
          </li>
          <li>
            The device credential is held in the platform&apos;s secure storage,
            and the server stores only a keyed hash of it.
          </li>
          <li>
            Access tokens are short-lived; rotating or revoking a device
            credential invalidates every token already issued for it.
          </li>
          <li>
            Pairing codes and session join codes are temporary and stored only
            as keyed hashes.
          </li>
          <li>
            SDP and ICE candidate payloads are not written to production logs.
          </li>
          <li>TURN credentials are time-limited.</li>
        </ul>
      </DocumentSection>

      <DocumentSection title="Retention and deletion">
        <p>
          <span>
            Everything SonicRelay collects is deleted automatically within 90
            days of being collected.
          </span>{" "}
          A background job on the backend runs daily and permanently deletes
          records once they reach the retention limit. Age is measured from when
          a record was created, not from when it was last used, so continuing to
          use the app does not extend how long earlier data is kept.
        </p>
        <p>
          Deletion is permanent. Records are removed outright rather than
          flagged as deleted, and no copy is kept in an archive or audit table.
          In practice the cleanup runs at 82 days, ahead of the 90-day limit, so
          that a delayed job or a database backup taken shortly before deletion
          cannot cause data to outlive the limit.
        </p>
        <p>
          Because a device identifier is itself collected data, it is not kept
          indefinitely either. A device in regular use is automatically issued a
          new identifier roughly every 60 days, and the previous one is
          permanently deleted along with any record of what replaced it. This
          happens in the background; your pairings and any active session
          continue to work. A device that stops connecting is deleted outright
          when it reaches the retention limit, after which it must register and
          pair again.
        </p>
        <p>
          Some data is deleted much sooner: pairing challenges and session join
          codes expire within minutes and are cleared within about a day, and a
          participant record from a session you have left is removed within
          about a day.
        </p>
        <p>
          You can also delete data yourself, at any time. In the app,{" "}
          <span>Settings → Reset device identity</span> removes the credential
          stored on the device, and <span>Settings → Manage pairings</span>{" "}
          revokes a pairing. Clearing the app storage or uninstalling the app
          removes local data from the device. For anything else, contact the
          address below.
        </p>
      </DocumentSection>

      <DocumentSection title="Children">
        <p>
          SonicRelay is not directed specifically to children. It is intended as
          a personal audio utility for users who can set up a Windows publisher
          app and a paired mobile viewer.
        </p>
      </DocumentSection>

      <DocumentSection title="Contact">
        <p>
          For privacy questions, deletion requests, or Play Store review
          support, contact:
          <a href="mailto:vitorhugoalvesferreira@gmail.com">
            vitorhugoalvesferreira@gmail.com
          </a>
          .
        </p>
      </DocumentSection>

      <DocumentSection title="Changes">
        <p>
          This policy may be updated when SonicRelay changes how it handles
          data, permissions, backend infrastructure, third-party services, or
          platform requirements. The latest version will be published on this
          page.
        </p>
      </DocumentSection>
    </DocumentLayout>
  );
}
