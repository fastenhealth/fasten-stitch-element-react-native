import React, { useCallback, useState } from 'react';
import { Button, Modal, StyleSheet, View } from 'react-native';
import base64 from 'react-native-base64';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

/* *
* This component is intended to replace the Fasten Connect Stitch.js widget in a React Native app.
*
* The Stitch.js Widget is responsible for the following:
* 1. Allowing patients to find their healthcare providers
* 2. Opening a modal popup to the Fasten Connect API `connect` endpoint - https://docs.connect.fastenhealth.com/api-reference/registration/connect
* 3. Redirecting the user to the Patient Portal for their healthcare institution to login and consent
* 4. Redirecting back to the Fasten Connect API Callback endpoint
* 5. Sending data back to the customer regarding the connection Fasten Connect has established with the patient & their healthcare provider
*
* While this process is straightforward in a web browser, it is complicated in a React Native app:
* - `window.open` does not work as expected in React Native WebViews, as it is designed for web browsers.
* - `window.close` does not work in React Native WebViews, as it is also designed for web browsers.
* - messaging between the Stitch SDK and the parent window/app is done via event bubbling.
*
* Instead, our React Native solution involves two WebViews and 2 "entities" that need to communicate with each other:
* 1. The Primary WebView - this is the main WebView that loads the webpage displaying the Fasten Connect UI.
* 2. The Modal WebView - this is the WebView that opens when the Fasten Connect UI tries to open a popup.
*
* Communication between WebViews is handled via a Websocket channel that is automatically created.
* */

// List of entities that need to communicate with each other
const CommunicationEntityPrimaryWebView = 'FASTEN_CONNECT_PRIMARY_WEBVIEW';
const CommunicationEntityReactNativeComponent = 'FASTEN_CONNECT_REACT_WEBVIEW';
const CommunicationEntityExternal = 'FASTEN_CONNECT_EXTERNAL';

const CommunicationActionModalWebviewCloseRequest = 'FASTEN_CONNECT_MODAL_WEBVIEW_CLOSE_REQUEST';

export interface FastenStitchElementOptions {
  publicId: string;
  debugModeEnabled?: boolean;
  externalId?: string;
  staticBackdrop?: boolean;
  reconnectOrgConnectionId?: string;
  brandId?: string;
  portalId?: string;
  endpointId?: string;
  searchQuery?: string;
  searchSortBy?: string;
  searchSortByOpts?: string;
  searchOnly?: boolean;
  showSplash?: boolean;
  tefcaMode?: boolean;
  tefcaCspPromptForce?: boolean;
  eventTypes?: string;
  onEventBus?: (data: unknown) => void;
}

type FastenStitchElementQueryParams = Omit<FastenStitchElementOptions, 'onEventBus' | 'debugModeEnabled'>;

interface FastenStitchElementMessage {
  action?: string;
  to?: string;
  payload?: string;
}

const FastenStitchElement = ({
  onEventBus,
  debugModeEnabled,
  ...queryParams

}: FastenStitchElementOptions) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalUrl, setModalUrl] = useState('');

  const dismissModal = useCallback(() => {
    console.debug('[FastenStitchElement] dismissing modal');
    setModalVisible(false);
    setModalUrl('');
  }, []);

  const interceptWindowOpen = useCallback(({ nativeEvent }: any) => {
    const { targetUrl } = nativeEvent;
    if (!targetUrl) {
      console.warn('[FastenStitchElement] window.open intercepted without a targetUrl');
      return;
    }
    setModalUrl(targetUrl);
    setModalVisible(true);
  }, []);

  const createMessageHandler = useCallback(
    (currentWebviewEntity: string) => ({ nativeEvent }: WebViewMessageEvent) => {
      const { data } = nativeEvent;
      if (!data) {
        console.warn(`[${currentWebviewEntity}] empty message received`);
        return;
      }

      let message: FastenStitchElementMessage;
      try {
        message = JSON.parse(data);
      } catch (error) {
        console.error(`[${currentWebviewEntity}] failed to parse message`, error);
        return;
      }

      if (
        message.action === CommunicationActionModalWebviewCloseRequest &&
        message.to === CommunicationEntityReactNativeComponent
      ) {
        console.debug(`[${currentWebviewEntity}] received modal close request`);
        dismissModal();
        return;
      }

      if (message.to === CommunicationEntityExternal) {
        console.debug(`[${CommunicationEntityExternal}] message intended for customer application`, message);
        if (!message.payload) {
          console.warn('[FastenStitchElement] empty payload received');
          return;
        }

        try {
          if (onEventBus) {
            onEventBus(JSON.parse(message.payload));
          } else {
            console.warn('[FastenStitchElement] onEventBus handler missing');
          }
        } catch (error) {
          console.error('[FastenStitchElement] failed to parse payload', error);
        }
      }
    },
    [dismissModal, onEventBus]
  );

  const handleModalLoadEnd = useCallback(
    (navState: any) => {
      const callbackUrl = navState.nativeEvent.url;
      //bridge/callback is the final url served by Fasten Connect API in production. It will contain a window.close() call to close the modal.
      //bridge/identity_verification/callback is the final url used for TEFCA mode identity verification flow
      if (
        callbackUrl.includes('fastenhealth.com/v1/bridge/callback') ||
        callbackUrl.includes('fastenhealth.com/v1/bridge/identity_verification/callback')
      ) {
        dismissModal();
      }
    },
    [dismissModal]
  );

  const queryString = encodeOptionsAsQueryStringParameters(queryParams);

  return (
    <View style={styles.root}>
      <WebView
        source={{
          uri: `https://embed.connect.fastenhealth.com/?${queryString}`,
        }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        originWhitelist={['*']}
        webviewDebuggingEnabled={debugModeEnabled}
        onOpenWindow={interceptWindowOpen}
        onMessage={createMessageHandler(CommunicationEntityPrimaryWebView)}
        onError={({ nativeEvent }) => {
          console.error('[FastenStitchElement PrimaryWebView] error', nativeEvent);
        }}
      />

      <Modal visible={modalVisible} onRequestClose={dismissModal} animationType="slide">
        <View style={styles.modalContainer}>
          <WebView
            source={{ uri: modalUrl }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
            webviewDebuggingEnabled={debugModeEnabled}
            onLoadEnd={handleModalLoadEnd}
            onMessage={createMessageHandler(CommunicationEntityPrimaryWebView)}
            onError={({ nativeEvent }) => {
              console.error('[FastenStitchElement ModalWebView] error', nativeEvent);
            }}
          />
          <Button title="Close" onPress={dismissModal} />
        </View>
      </Modal>
    </View>
  );
};

function encodeOptionsAsQueryStringParameters(sdkOptions: FastenStitchElementQueryParams): string {
  const params = new URLSearchParams();
  params.append('public-id', sdkOptions.publicId);

  if (sdkOptions.externalId) {
    params.append('external-id', sdkOptions.externalId);
  }
  if (sdkOptions.reconnectOrgConnectionId) {
    params.append('reconnect-org-connection-id', sdkOptions.reconnectOrgConnectionId);
  }
  if (sdkOptions.searchOnly) {
    params.append('search-only', sdkOptions.searchOnly.toString());
    if (sdkOptions.searchQuery) {
      params.append('search-query', sdkOptions.searchQuery);
    }
    if (sdkOptions.searchSortBy) {
      params.append('search-sort-by', sdkOptions.searchSortBy);
      if (sdkOptions.searchSortByOpts) {
        params.append('search-sort-by-opts', base64.encode(sdkOptions.searchSortByOpts));
      }
    }
    if (sdkOptions.showSplash) {
      params.append('show-splash', sdkOptions.showSplash.toString());
    }
  }

  if (sdkOptions.brandId) {
    params.append('brand-id', sdkOptions.brandId);
  }
  if (sdkOptions.portalId) {
    params.append('portal-id', sdkOptions.portalId);
  }
  if (sdkOptions.endpointId) {
    params.append('endpoint-id', sdkOptions.endpointId);
  }

  if (sdkOptions.tefcaMode) {
    params.append('tefca-mode', sdkOptions.tefcaMode.toString());
    params.append('search-only', 'false');
    if (sdkOptions.tefcaCspPromptForce) {
      params.append('tefca-csp-prompt-force', sdkOptions.tefcaCspPromptForce.toString());
    }
  }

  if (sdkOptions.eventTypes) {
    params.append('event-types', sdkOptions.eventTypes);
  }

  params.append('connect-mode', 'websocket');
  params.append('sdk-mode', 'react-native');

  return params.toString();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
});

export default FastenStitchElement;
