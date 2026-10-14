import type { CapacitorConfig } from '@capacitor/cli'

// iOS-Hülle um die gebaute Web-App (dist). appId ist die Bundle-ID und muss zu App Store Connect passen.
const config: CapacitorConfig = {
  appId: 'ch.niflow.app',
  appName: 'NiFlow',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#F2F2F7',
  },
}

export default config
