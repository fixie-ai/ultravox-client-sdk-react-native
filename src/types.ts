/* The current status of an UltravoxSession. */
export enum UltravoxSessionStatus {
  /* The session is not connected and not attempting to connect. This is the initial state. */
  DISCONNECTED = 'disconnected',
  /* The client is disconnecting from the session. */
  DISCONNECTING = 'disconnecting',
  /* The client is attempting to connect to the session. */
  CONNECTING = 'connecting',
  /* The client is connected to the session and the server is warming up. */
  IDLE = 'idle',
  /* The client is connected and the server is listening for voice input. */
  LISTENING = 'listening',
  /* The client is connected and the server is considering its response. The user can still interrupt. */
  THINKING = 'thinking',
  /* The client is connected and the server is playing response audio. The user can interrupt as needed. */
  SPEAKING = 'speaking',
}

/** The participant responsible for an utterance. */
export type Role = 'user' | 'agent';

/* How a message was communicated. */
export type Medium = 'voice' | 'text';

/** A transcription of a single utterance. */
export class Transcript {
  constructor(
    /* The possibly-incomplete text of an utterance. */
    readonly text: string,
    /* Whether the text is complete or the utterance is ongoing. */
    readonly isFinal: boolean,
    /* Who emitted the utterance. */
    readonly speaker: Role,
    /* The medium through which the utterance was emitted. */
    readonly medium: Medium,
    /* The ordinal for sorting the transcript */
    readonly ordinal: number
  ) {}
}

/* How the agent should proceed after a tool invocation. */
export enum AgentReaction {
  /* The agent should speak after the tool invocation. This is the default and is recommended for tools that retrieve information for the agent to act on. */
  SPEAKS = 'speaks',
  /* The agent should listen after the tool invocation. This is recommended for tools the user is expected to act on, such as certain clear UI changes. */
  LISTENS = 'listens',
  /* The agent should speak after the tool invocation if and only if it did not speak immediately before the tool invocation. This is recommended for tools whose primary purpose is a side effect like recording information collected from the user. */
  SPEAKS_ONCE = 'speaks-once',
}

/** A data message sent to or received from Ultravox. */
export type DataMessage = {
  type: string;
  [key: string]: any;
};

/** The type for what's returned by a client-implemented tool. */
type ClientToolReturnType =
  | string
  | {
      result: string;
      responseType: string;
      agentReaction?: AgentReaction | null;
      updateCallState?: Record<string, unknown> | null;
    };

/** The type for a client-implemented tool function. */
export type ClientToolImplementation = (parameters: {
  [key: string]: any;
}) => ClientToolReturnType | Promise<ClientToolReturnType>;

/** Event types emitted by UltravoxSession. */
export type UltravoxEventType = 'status' | 'transcripts' | 'data_message';

/** Payload for status change events. */
export interface StatusChangeEvent {
  status: UltravoxSessionStatus;
}

/** Payload for transcript update events. */
export interface TranscriptsChangeEvent {
  transcripts: Transcript[];
}

/** Data message event payload. */
export interface DataMessageEvent {
  message: DataMessage;
}
