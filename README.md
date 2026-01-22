
# Fasten Connect React Native SDK (Beta)

This project provides a React Native SDK for integrating Fasten Connect into your application. **Please note that this 
SDK is currently in beta and may not reflect the final version of the Fasten Connect React Native SDK.**

## Prerequisites

Before setting up the project, ensure you have the following installed:

- **Node.js** (v14 or later)
- **Yarn**
- **React Native CLI**
- A working React Native environment (iOS/Android)

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Install dependencies**:
   Use `yarn` to install the required dependencies:
   ```bash
   yarn install
   ```

3. **Configure the SDK**:
    - Replace `CUSTOMER_PUBLIC_ID` in the `App.ts` file with your actual public ID provided by Fasten Connect.

4. **Run the application**:
    ```
   npx expo start
   ```

## Notes

- This SDK uses `WebView` to embed Fasten Connect functionality. Ensure your app has the necessary permissions and configurations for `WebView` to work correctly.

## Known Issues

- The SDK is in beta, and some features may not work as expected.
- Documentation and API stability are subject to change in future releases.
- Styles and UI components may not be fully customizable at this stage.

## Feedback

We welcome your feedback! Please report any issues or suggestions via the issue tracker in this repository.

---

**Disclaimer**: This SDK is provided as-is during the beta phase. Use it at your own risk in production environments.
```