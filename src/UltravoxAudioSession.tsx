import React, { useEffect, type JSX } from 'react';
import { AudioSession } from '@livekit/react-native';

interface UltravoxAudioSessionProps {
  children: React.ReactNode;
}

/**
 * Component that manages the native audio session for Ultravox calls.
 * Wrap your app or call screen with this component to ensure proper
 * audio configuration on iOS and Android.
 */
export function UltravoxAudioSession({
  children,
}: UltravoxAudioSessionProps): JSX.Element {
  useEffect(() => {
    // Configure audio session for bidirectional communication
    const configureAudio = async () => {
      await AudioSession.configureAudio({
        android: {
          // Use communication mode for voice calls
          audioTypeOptions: {
            manageAudioFocus: true,
          },
        },
        ios: {
          // Use voice chat category for bidirectional audio
          defaultOutput: 'speaker',
        },
      });

      await AudioSession.startAudioSession();
    };

    configureAudio();

    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  return <>{children}</>;
}
