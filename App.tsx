import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import FastenStitchElement from './FastenStitchElement';

export default function App() {
  const CUSTOMER_PUBLIC_ID = "public_test_6f5j7qj54rlyajv6u8r36z0iu5v9qjf87f77tzl3k6ezu";

  const handleEventBus = useCallback((message: unknown) => {
    console.debug('[FastenStitchElement onEventBus] message', message);
  }, []);

  return (
    <View style={styles.root}>
      <FastenStitchElement
        publicId={CUSTOMER_PUBLIC_ID}
        debugModeEnabled
        onEventBus={handleEventBus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
