import { Room, RoomEvent, Track } from 'livekit-client';
import { registerGlobals } from '@livekit/react-native';

import {
  UltravoxSessionStatus,
  Transcript,
  type Role,
  type Medium,
  type ClientToolImplementation,
  type DataMessage,
  type UltravoxEventType,
  type StatusChangeEvent,
  type TranscriptsChangeEvent,
  type DataMessageEvent,
} from './types';

import { ULTRAVOX_SDK_VERSION } from './version';

type EventCallback<T> = (event: T) => void;
type EventCallbackMap = {
  status: EventCallback<StatusChangeEvent>;
  transcripts: EventCallback<TranscriptsChangeEvent>;
  data_message: EventCallback<DataMessageEvent>;
};

/**
 * Manages a single session with Ultravox and emits events to notify consumers of
 * state changes.
 */
export class UltravoxSession {
  private socket: WebSocket | null = null;
  private room: Room | null = null;
  private _status: UltravoxSessionStatus = UltravoxSessionStatus.DISCONNECTED;
  private _transcripts: Array<Transcript | null> = [];
  private _isMicMuted: boolean = false;
  private _isSpeakerMuted: boolean = false;

  private eventListeners: Map<UltravoxEventType, Set<Function>> = new Map();
  private toolImplementations: Map<string, ClientToolImplementation> =
    new Map();

  private additionalMessages: Set<string> = new Set();
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  constructor({ additionalMessages }: { additionalMessages?: string[] } = {}) {
    if (additionalMessages) {
      additionalMessages.forEach((msg) => this.additionalMessages.add(msg));
    }
    this.eventListeners.set('status', new Set());
    this.eventListeners.set('transcripts', new Set());
    this.eventListeners.set('data_message', new Set());
  }

  /** Retrieves the current session status. */
  get status(): UltravoxSessionStatus {
    return this._status;
  }

  /** Retrieves the current list of transcripts. */
  get transcripts(): Transcript[] {
    return [...this._transcripts.filter((t) => t != null)] as Transcript[];
  }

  /**
   * Indicates whether the user's mic is currently muted for the session. (Does not inspect
   * hardware state.)
   */
  get isMicMuted(): boolean {
    return this._isMicMuted;
  }

  /**
   * Indicates whether the user's speaker (e.g. agent output audio) is currently muted for the
   * session. (Does not inspect system volume or hardware state.)
   */
  get isSpeakerMuted(): boolean {
    return this._isSpeakerMuted;
  }

  /** Joins an Ultravox call using the provided join URL. */
  async joinCall(
    joinUrl: string,
    { clientVersion }: { clientVersion?: string } = {}
  ): Promise<void> {
    if (this._status !== UltravoxSessionStatus.DISCONNECTED) {
      throw new Error(
        `Cannot join call in status ${this._status}. Must be disconnected.`
      );
    }

    registerGlobals();
    const url = new URL(joinUrl);
    let uvClientVersion = `rn_${ULTRAVOX_SDK_VERSION}`;
    if (clientVersion) {
      uvClientVersion += `:${clientVersion}`;
    }
    url.searchParams.set('clientVersion', uvClientVersion);
    url.searchParams.set('apiVersion', '1');
    if (this.additionalMessages) {
      url.searchParams.set(
        'additionalMessages',
        Array.from(this.additionalMessages.values()).join(',')
      );
    }
    joinUrl = url.toString();
    this.setStatus(UltravoxSessionStatus.CONNECTING);
    this.socket = new WebSocket(joinUrl);
    this.socket.onmessage = (event) => this.handleSocketMessage(event);
    this.socket.onclose = () => this.handleSocketClose();
  }

  /** Leave the current call. */
  async leaveCall(): Promise<void> {
    await this.disconnect();
  }

  /** Sends a text message to the agent. */
  sendText(
    text: string,
    { urgency }: { urgency?: 'immediate' | 'soon' | 'later' } = {}
  ): void {
    this.sendDataMessage({ type: 'user_text_message', text, urgency });
  }

  /**
   * Sets the agent's output medium. If the agent is currently speaking, this will take effect at
   * the end of the agent's utterance. Also see muteSpeaker and unmuteSpeaker below.
   */
  setOutputMedium(medium: Medium): void {
    this.sendDataMessage({ type: 'set_output_medium', medium });
  }

  /** Sends an arbitrary data message. */
  sendDataMessage(message: DataMessage): void {
    const json = JSON.stringify(message);
    const data = this.textEncoder.encode(json);
    if (data.length > 1024) {
      this.socket?.send(json);
    } else {
      this.room?.localParticipant.publishData(data, { reliable: true });
    }
  }

  /** Mutes audio input from the user. */
  muteMic(): void {
    this._isMicMuted = true;
    this.room?.localParticipant?.setMicrophoneEnabled(!this._isMicMuted);
  }

  /** Unmutes audio input from the user. */
  unmuteMic(): void {
    this._isMicMuted = false;
    this.room?.localParticipant?.setMicrophoneEnabled(!this._isMicMuted);
  }

  /** Toggles the mute state of the user's audio input. */
  toggleMicMute(): void {
    if (this.isMicMuted) {
      this.unmuteMic();
    } else {
      this.muteMic();
    }
  }

  /** Mutes audio output from the agent. */
  muteSpeaker(): void {
    this._isSpeakerMuted = true;
    this.room?.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        publication.setEnabled(!this._isSpeakerMuted);
      });
    });
  }

  /** Unmutes audio output from the agent. */
  unmuteSpeaker(): void {
    this._isSpeakerMuted = false;
    this.room?.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        publication.setEnabled(!this._isSpeakerMuted);
      });
    });
  }

  /** Toggles the mute state of the agent's output audio. */
  toggleSpeakerMute(): void {
    if (this.isSpeakerMuted) {
      this.unmuteSpeaker();
    } else {
      this.muteSpeaker();
    }
  }

  /** Registers a client tool implementation. */
  registerToolImplementation(
    name: string,
    implementation: ClientToolImplementation
  ): void {
    this.toolImplementations.set(name, implementation);
  }

  /** Registers multiple client tool implementations. */
  registerToolImplementations(
    implementations: Record<string, ClientToolImplementation>
  ): void {
    Object.entries(implementations).forEach(([name, impl]) => {
      this.registerToolImplementation(name, impl);
    });
  }

  /** Adds an event listener. */
  addEventListener<T extends UltravoxEventType>(
    eventType: T,
    callback: EventCallbackMap[T]
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.add(callback);
    }
  }

  /** Removes an event listener. */
  removeEventListener<T extends UltravoxEventType>(
    eventType: T,
    callback: EventCallbackMap[T]
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private async handleSocketMessage(event: WebSocketMessageEvent) {
    const msg = JSON.parse(event.data);
    this.room = new Room();
    this.room.on(RoomEvent.TrackSubscribed, (_track, publication) => {
      if (publication.kind === Track.Kind.Audio) {
        publication.setEnabled(!this.isSpeakerMuted);
      }
      this.room?.startAudio();
    });
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array) =>
      this.handleDataReceived(payload)
    );
    this.room.on(RoomEvent.Disconnected, async () => {
      await this.disconnect();
    });
    await this.room?.connect(msg.roomUrl, msg.token);
    await this.room?.localParticipant?.setMicrophoneEnabled(!this.isMicMuted);
    this.setStatus(UltravoxSessionStatus.IDLE);
  }

  private async handleSocketClose() {
    await this.disconnect();
  }

  private async disconnect() {
    if (
      this._status === UltravoxSessionStatus.DISCONNECTED ||
      this._status === UltravoxSessionStatus.DISCONNECTING
    ) {
      return;
    }
    this.setStatus(UltravoxSessionStatus.DISCONNECTING);
    await this.room?.disconnect();
    this.socket?.close();
    this.room = null;
    this.socket = null;
    this.setStatus(UltravoxSessionStatus.DISCONNECTED);
  }

  private handleDataReceived(payload: Uint8Array): void {
    try {
      const message = JSON.parse(this.textDecoder.decode(payload));
      this.emitEvent('data_message', { message });

      switch (message.type) {
        case 'state':
          switch (message.state) {
            case 'listening':
              this.setStatus(UltravoxSessionStatus.LISTENING);
              break;
            case 'thinking':
              this.setStatus(UltravoxSessionStatus.THINKING);
              break;
            case 'speaking':
              this.setStatus(UltravoxSessionStatus.SPEAKING);
              break;
          }
          break;
        case 'transcript':
          this.handleTranscript(message);
          break;
        case 'client_tool_invocation':
          this.handleToolInvocation(
            message.toolName,
            message.invocationId,
            message.parameters
          );
          break;
      }
    } catch (error) {
      console.error('Failed to parse data message:', error);
    }
  }

  private handleTranscript(data: any): void {
    const medium: Medium = data.medium === 'text' ? 'text' : 'voice';
    const role: Role = data.role === 'agent' ? 'agent' : 'user';
    const ordinal: number = data.ordinal;
    const isFinal: boolean = data.final === true;
    if (data.text != null) {
      this.addOrUpdateTranscript({
        ordinal,
        medium,
        role,
        isFinal,
        text: data.text as string,
      });
    } else if (data.delta != null) {
      this.addOrUpdateTranscript({
        ordinal,
        medium,
        role,
        isFinal,
        delta: data.delta as string,
      });
    }
  }

  private addOrUpdateTranscript({
    ordinal,
    medium,
    role,
    isFinal,
    text,
    delta,
  }: {
    ordinal: number;
    medium: Medium;
    role: Role;
    isFinal: boolean;
    text?: string;
    delta?: string;
  }): void {
    while (this._transcripts.length < ordinal) {
      this._transcripts.push(null);
    }
    if (this._transcripts.length === ordinal) {
      this._transcripts.push(
        new Transcript(text || delta || '', isFinal, role, medium, ordinal)
      );
    } else {
      const priorText = this._transcripts[ordinal]?.text || '';
      this._transcripts[ordinal] = new Transcript(
        text || priorText + (delta || ''),
        isFinal,
        role,
        medium,
        ordinal
      );
    }
    this.emitEvent('transcripts', { transcripts: this.transcripts });
  }

  private async handleToolInvocation(
    toolName: string,
    invocationId: string,
    parameters: Record<string, any>
  ): Promise<void> {
    const implementation = this.toolImplementations.get(toolName);

    if (!implementation) {
      this.sendDataMessage({
        type: 'client_tool_result',
        invocationId,
        errorType: 'undefined',
        errorMessage: `Client tool "${toolName}" is not registered (React Native client)`,
      });
      return;
    }

    try {
      const result = await implementation(parameters);
      if (typeof result === 'string') {
        this.sendDataMessage({
          type: 'client_tool_result',
          invocationId,
          result,
        });
      } else {
        this.sendDataMessage({
          type: 'client_tool_result',
          invocationId,
          ...result,
        });
      }
    } catch (error) {
      this.sendDataMessage({
        type: 'client_tool_result',
        invocationId,
        errorType: 'implementation-error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private setStatus(status: UltravoxSessionStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.emitEvent('status', { status });
    }
  }

  private emitEvent<T extends UltravoxEventType>(
    eventType: T,
    payload: T extends 'status'
      ? StatusChangeEvent
      : T extends 'transcripts'
      ? TranscriptsChangeEvent
      : DataMessageEvent
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(payload);
        } catch (error) {
          console.warn(`Error in event listener for ${eventType}:`, error);
        }
      }
    }
  }
}
