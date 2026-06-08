import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fadiandyaqeen.mendly',
  appName: 'Mendly',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: [
      '10.0.2.2',
      'localhost',
      '127.0.0.1',
    ],
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#6BA7E6',
    },
  },
};

export default config;