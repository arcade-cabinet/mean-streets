import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arcadecabinet.meanstreets',
  appName: 'Mean Streets',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#090909',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#090909',
      overlaysWebView: true,
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      iosKeychainPrefix: 'mean-streets',
      androidIsEncryption: false,
    },
  },
};

export default config;
