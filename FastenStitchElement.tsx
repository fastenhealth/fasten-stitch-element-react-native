import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button, Modal, StyleSheet, View} from 'react-native';
import base64 from 'react-native-base64'
import {WebView} from "react-native-webview";

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



// //List of entities that need to communicate with each other
// // TODO: enums don't seem to work? Could be an issue with our development env, but we will use string constants instead.
// // TODO: these constants are hardcoded on the Fasten Connect API side as well, which is not ideal. Will require lock-step deployments
const CommunicationEntityPrimaryWebView = 'FASTEN_CONNECT_PRIMARY_WEBVIEW'
const CommunicationEntityReactNativeComponent = 'FASTEN_CONNECT_REACT_WEBVIEW' //this is the Fasten Connect React Native component that contains the two WebViews (this file)
const CommunicationEntityExternal = 'FASTEN_CONNECT_EXTERNAL' // this is data that will be sent to the customer's app, for them to handle.

const CommunicationActionModalWebviewCloseRequest = 'FASTEN_CONNECT_MODAL_WEBVIEW_CLOSE_REQUEST';


/**
 * @typedef {Object} SdkOptions
 * @property {string} [publicId]
 * @property {string|null} [externalId]
 * @property {boolean|null} [staticBackdrop]
 * @property {string|null} [reconnectOrgConnectionId]
 * @property {string|null} [brandId]
 * @property {string|null} [portalId]
 * @property {string|null} [endpointId]
 * @property {string|null} [searchQuery]
 * @property {string|null} [searchSortBy]
 * @property {string|null} [searchSortByOpts]
 * @property {boolean|null} [searchOnly]
 * @property {boolean|null} [showSplash]
 * @property {boolean|null} [tefcaMode]
 * @property {boolean|null} [tefcaCspPromptForce]
 * @property {string|null} [eventTypes]
 * @property {function|null} [onEventBus]
 */
const FastenStitchElement = (options: SdkOptions) => {
  // onEventBus("FastenStitchElement mounted with props:")

  const primaryWebViewRef = useRef(null);
  const modalWebViewRef = useRef(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalUrl, setModalUrl] = useState('');


  //function to disable modal on request from PrimaryWebView
  const dismissModal = useCallback(() => {
    console.debug('[FastenStitchElement] dismissing modal');
    setModalVisible(false);
    setModalUrl('');
  }, []);

  //intercept window.open calls from the Primary WebView
  const interceptWindowOpen = useCallback(({ nativeEvent }: any) => {
    const { targetUrl } = nativeEvent;
    if (!targetUrl) {
      console.warn('[PrimaryWebView] window.open intercepted without a targetUrl');
      return;
    }
    setModalUrl(targetUrl);
    setModalVisible(true);
  }, []);

  //message handler for messages from PrimaryWebview that need to be handled by the actual App (bubbled out of the SDK)
  const createMessageHandler = useCallback(
      (currentWebviewEntity:any) => ({ nativeEvent }: any) => {
        const { data } = nativeEvent;
        if (!data) {
          console.warn(`[${currentWebviewEntity}] empty message received`);
          return;
        }

        let message;
        try {
          message = JSON.parse(data);
        } catch (error) {
          console.error(`[${currentWebviewEntity}] failed to parse message`, error);
          return;
        }

        if (message.action === CommunicationActionModalWebviewCloseRequest && message.to === CommunicationEntityReactNativeComponent) {
          console.debug(`[${currentWebviewEntity}] received modal close request`);
          dismissModal();
          return;
        }

        if (message.to === CommunicationEntityExternal) {
          console.debug(`[${CommunicationEntityExternal}] message intended for customer application`, message);
          if (options.onEventBus) {
              options.onEventBus(JSON.parse(message.payload));
          } else {
              console.warn('No onEventBus handler provided in options to receive event:', message);
          }
          return;
        }
      },
      [dismissModal]
  );



  return (
      <View style={styles.root}>
        <WebView
            ref={primaryWebViewRef}
            source={{
              uri: `https://embed.connect.fastenhealth.com/?${encodeOptionsAsQueryStringParameters(options)}`,
            }}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            originWhitelist={['*']}
            webviewDebuggingEnabled={options.debugModeEnabled}
            onOpenWindow={interceptWindowOpen}
            onMessage={createMessageHandler(CommunicationEntityPrimaryWebView)}
            onError={({ nativeEvent }) => {
              console.error('[PrimaryWebView] error', nativeEvent);
            }}
        />

        <Modal visible={modalVisible} onRequestClose={dismissModal} animationType="slide">
          <View style={styles.modalContainer}>
            <WebView
                ref={modalWebViewRef}
                source={{ uri: modalUrl }}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                mixedContentMode="always"
                webviewDebuggingEnabled={options.debugModeEnabled}
                onLoadEnd={(navState) => {
                  //bridge/callback is the final url served by Fasten Connect API in production. It will contain a window.close() call to close the modal.
                  //bridge/identity_verification/callback is the final url used for TEFCA mode identity verification flow
                  if(
                      navState.nativeEvent.url.includes('fastenhealth.com/v1/bridge/callback') || navState.nativeEvent.url.includes('fastenhealth.com/v1/bridge/identity_verification/callback')
                  ) {
                    dismissModal()
                  }
                }}
                onError={({ nativeEvent }) => {
                  console.error('[ModalWebView] error', nativeEvent);
                }}
            />
            <Button title="Close" onPress={dismissModal} />
          </View>
        </Modal>
      </View>
  );
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//HELPERS

interface SdkOptions {
  debugModeEnabled?: boolean
  publicId: string,
  externalId?: string,
  staticBackdrop?: boolean,
  reconnectOrgConnectionId?: string,
  brandId?: string,
  portalId?: string,
  endpointId?: string,
  searchQuery?: string,
  searchSortBy?: string,
  searchSortByOpts?: string,
  searchOnly?: boolean,
  showSplash?: boolean,
  tefcaMode?: boolean,
  tefcaCspPromptForce?: boolean,
  eventTypes?: string,
  onEventBus?: (data: any) => void,
}

//the element options must be encoded as query string parameters and then appended to the iframe src
function encodeOptionsAsQueryStringParameters(sdkOptions: SdkOptions): string {

  let params = new URLSearchParams();
  if(sdkOptions.publicId) {
    params.append('public-id', sdkOptions.publicId)
  }
  if(sdkOptions.externalId) {
    params.append('external-id', sdkOptions.externalId)
  }
  if(sdkOptions.reconnectOrgConnectionId) {
    params.append('reconnect-org-connection-id', sdkOptions.reconnectOrgConnectionId)
  }
  if(sdkOptions.searchOnly) {
    params.append('search-only', sdkOptions.searchOnly.toString())
    if(sdkOptions.searchQuery) {
      params.append('search-query', sdkOptions.searchQuery)
    }
    if(sdkOptions.searchSortBy) {
      params.append('search-sort-by', sdkOptions.searchSortBy)
      if(sdkOptions.searchSortByOpts) {
        params.append('search-sort-by-opts', base64.encode(sdkOptions.searchSortByOpts))
      }
    }
    if(sdkOptions.showSplash) {
      params.append('show-splash', sdkOptions.showSplash.toString())
    }
  }

  if(sdkOptions.brandId){
    params.append('brand-id', sdkOptions.brandId)
  }
  if(sdkOptions.portalId){
    params.append('portal-id', sdkOptions.portalId)
  }
  if(sdkOptions.endpointId){
    params.append('endpoint-id', sdkOptions.endpointId)
  }

  if(sdkOptions.tefcaMode) {
    params.append('tefca-mode', sdkOptions.tefcaMode.toString())
    //if tefaMode is true, search-only must be false
    params.append('search-only', false.toString())
    if(sdkOptions.tefcaCspPromptForce){
      params.append('tefca-csp-prompt-force', sdkOptions.tefcaCspPromptForce.toString())
    }
  }

  if(sdkOptions.eventTypes) {
    params.append('event-types', sdkOptions.eventTypes)
  }

  //v4 -- connect_mode should always be `websocket`
  params.append('connect-mode', 'websocket')
  params.append('sdk-mode', 'react-native')

  console.log('Encoded SDK Options as Query String Parameters:', params.toString());
  return params.toString()
}

const commonOnNavigationStateChangeScript = (currentWebviewEntity: any) => `
  (function() {
    const originalClose = window.close;
    window.close = function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          from: '${currentWebviewEntity}',
          to: '${CommunicationEntityReactNativeComponent}',
          action: '${CommunicationActionModalWebviewCloseRequest}'
        }));
      }
      if (originalClose) {
        try { originalClose(); } catch (err) { console.warn('window.close override error', err); }
      }
    };
  })();
  true;
`;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Default Styles


const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
});



export default FastenStitchElement;

