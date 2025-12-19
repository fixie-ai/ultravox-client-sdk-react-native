import React, { useEffect } from 'react';
import { View, StyleSheet, TextInput, Text, Button } from 'react-native';
import { useUltravox, type Transcript } from 'ultravox-react-native';

const UnjoinedScreen = ({
  onSubmit,
}: {
  onSubmit: (joinUrl: string) => any;
}) => {
  const [joinUrlInput, setJoinUrlInput] = React.useState('');

  const handleInputChange = (text: string) => {
    setJoinUrlInput(text);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        onChangeText={handleInputChange}
        onSubmitEditing={() => onSubmit(joinUrlInput)}
        value={joinUrlInput}
        placeholder="Enter Join URL"
      />
      <Button
        title="Join"
        onPress={() => onSubmit(joinUrlInput)}
        disabled={!joinUrlInput.trim()}
      />
    </View>
  );
};

const TranscriptView = ({
  callTranscript,
  showUserTranscripts = false,
}: {
  callTranscript: Transcript[];
  showUserTranscripts?: boolean;
}) => {
  return (
    <>
      {callTranscript.map((transcript) => (
        <Text key={`${transcript.ordinal}-${transcript.text}`}>
          {showUserTranscripts || transcript.speaker === 'agent' ? (
            <>
              {transcript.speaker.toUpperCase()}: {transcript.text}
            </>
          ) : (
            <></>
          )}
        </Text>
      ))}
    </>
  );
};

const JoinedScreen = ({ joinUrl }: { joinUrl: string }) => {
  const { transcripts, joinCall, leaveCall } = useUltravox();

  useEffect(() => {
    joinCall(joinUrl).catch((error) => {
      console.error('Failed to join call:', error);
    });

    return () => {
      leaveCall().catch((error) => {
        console.error('Failed to leave call:', error);
      });
    };
  }, [joinUrl, joinCall, leaveCall]);

  return (
    <View style={styles.container}>
      <TranscriptView callTranscript={transcripts} />
    </View>
  );
};

export default function App() {
  const [joinUrl, setJoinUrl] = React.useState<string | null>(null);

  return joinUrl ? (
    <JoinedScreen joinUrl={joinUrl} />
  ) : (
    <UnjoinedScreen onSubmit={setJoinUrl} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  displayText: {
    marginTop: 10,
    fontSize: 16,
  },
});
