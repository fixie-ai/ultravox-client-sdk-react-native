import { useState, useEffect, useCallback, useRef } from 'react';
import { UltravoxSession } from './UltravoxSession';
import {
  Transcript,
  type ClientToolImplementation,
  type StatusChangeEvent,
  type TranscriptsChangeEvent,
  type DataMessageEvent,
} from './types';

export interface UseUltravoxOptions {
  /** Tool implementations provided by the client. */
  tools?: Record<string, ClientToolImplementation>;
  /** Additional message types to subscribe to. */
  additionalMessages?: string[];
  /** Callback for status change events. */
  onStatusChange?: (event: StatusChangeEvent) => void;
  /** Callback for transcript update events. */
  onTranscriptsChange?: (event: TranscriptsChangeEvent) => void;
  /** Callback for data message events. */
  onDataMessage?: (event: DataMessageEvent) => void;
}

export interface UseUltravoxReturn {
  /** Current transcripts for an active call. */
  transcripts: Transcript[];
  /** Joins an Ultravox call. */
  joinCall: (
    joinUrl: string,
    joinOpts?: { clientVersion?: string }
  ) => Promise<void>;
  /** Leaves the current call. */
  leaveCall: () => Promise<void>;
  /** The underlying session instance */
  session: UltravoxSession;
}

/**
 * React hook for managing an Ultravox session
 */
export function useUltravox({
  tools,
  additionalMessages,
  onStatusChange,
  onTranscriptsChange,
  onDataMessage,
}: UseUltravoxOptions = {}): UseUltravoxReturn {
  const sessionRef = useRef<UltravoxSession | null>(null);

  // Initialize session on first render
  if (!sessionRef.current) {
    sessionRef.current = new UltravoxSession({ additionalMessages });
    if (tools) {
      sessionRef.current.registerToolImplementations(tools);
    }
  }

  const session = sessionRef.current;

  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  useEffect(() => {
    const handleTranscriptsChange = (event: { transcripts: Transcript[] }) => {
      setTranscripts([...event.transcripts]);
    };

    session.addEventListener('transcripts', handleTranscriptsChange);

    if (onStatusChange) {
      session.addEventListener('status', onStatusChange);
    }
    if (onTranscriptsChange) {
      session.addEventListener('transcripts', onTranscriptsChange);
    }
    if (onDataMessage) {
      session.addEventListener('data_message', onDataMessage);
    }

    return () => {
      session.removeEventListener('transcripts', handleTranscriptsChange);
      if (onStatusChange) {
        session.removeEventListener('status', onStatusChange);
      }
      if (onTranscriptsChange) {
        session.removeEventListener('transcripts', onTranscriptsChange);
      }
      if (onDataMessage) {
        session.removeEventListener('data_message', onDataMessage);
      }
    };
  }, [session, onStatusChange, onTranscriptsChange, onDataMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionRef.current?.leaveCall();
    };
  }, []);

  const joinCall = useCallback(
    async (
      joinUrl: string,
      joinOpts: { clientVersion?: string } | undefined
    ) => {
      await session.joinCall(joinUrl, joinOpts);
    },
    [session]
  );

  const leaveCall = useCallback(async () => {
    await session.leaveCall();
    setTranscripts([]);
  }, [session]);

  return {
    transcripts,
    joinCall,
    leaveCall,
    session,
  };
}
