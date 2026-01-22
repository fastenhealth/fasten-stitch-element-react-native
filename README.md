<p align="center">
  <a href="https://github.com/fastenhealth/">
  <img width="400" alt="fasten_view" src="https://github.com/fastenhealth/brand-kit/raw/main/connect/banner-transparent.png">
  </a>
</p>

# Fasten Connect React Native SDK (Beta)

A lightweight React Native SDK that embeds the Fasten Connect experience inside any React Native application. The
package wraps the Stitch.js workflow in a pair of coordinated `WebView`s so you can authenticate with provider portals
and receive connection events without leaving your native app.

> **Status:** Beta – APIs may change and you should validate the integration in your environment before shipping to
> production.

## Installation

Add the package to your project along with its React Native peer dependency:

```bash
npm install @fastenhealth/fasten-stitch-element-react-native react-native-webview
# or
yarn add @fastenhealth/fasten-stitch-element-react-native react-native-webview
```

`react-native-base64` is bundled with the SDK. If you do not already have `react-native-webview` installed, follow the
[official installation guide](https://github.com/react-native-webview/react-native-webview#installation) for your
platform(s).

## Usage

```tsx
import { FastenStitchElement } from 'fasten-connect-stitch-react-native';

const CUSTOMER_PUBLIC_ID = 'public_test_...';

export const ConnectScreen = () => (
  <FastenStitchElement
    publicId={CUSTOMER_PUBLIC_ID}
    debugModeEnabled
    onEventBus={(event) => {
      console.log('Fasten event', event);
    }}
  />
);
```

`FastenStitchElement` renders to fill the available space, so wrap it in a container that matches how you want it to appear in
your layout (e.g., a `View` with `flex: 1`).

### Props

The component accepts the following options (matching the Stitch.js widget configuration):

- `publicId` (**required**) – Your Fasten Connect public identifier.
- `externalId` – Identifier you want to associate with the patient/session.
- `reconnectOrgConnectionId` – Reconnect a previously established patient connection.
- `searchOnly`, `searchQuery`, `searchSortBy`, `searchSortByOpts`, `showSplash` – Configure the provider search
  experience.
- `brandId`, `portalId`, `endpointId` – Restrict the experience to a specific brand/portal/endpoint.
- `tefcaMode` -  Enable TEFCA flows
- `eventTypes` – Comma-delimited list of event types to receive.
- `debugModeEnabled` – Surfaces debugging tools in the embedded web views.
- `onEventBus` – Callback invoked with parsed payloads sent from Fasten Connect (e.g., when a connection is created).

Refer to `FastenConnectOptions` in `src/FastenStitchElement.tsx` for the complete, documented type definition.

## Building the SDK locally

Transpile TypeScript to the distributable `dist/` folder:

```bash
npm run build
```

## Feedback

Please open an issue with any bugs or requests. Your feedback will help us stabilize the public SDK interface.
