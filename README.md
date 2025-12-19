# ultravox-client-sdk-react-native
React Native client SDK for [Ultravox](https://ultravox.ai).

[![npm package](https://img.shields.io/npm/v/ultravox-react-native?label=ultravox-react-native&color=orange)](https://www.npmjs.com/package/ultravox-react-native)

## Installation


```sh
npm install ultravox-react-native
```


## Usage


```js
import { useUltravox } from 'ultravox-react-native';

// ...

  const { joinCall, leaveCall } = useUltravox();

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
```

See the included example app for a more complete example. To get a `joinUrl`, you'll want to integrate your server with the [Ultravox REST API](https://docs.ultravox.ai)

## Testing SDK Changes

This repo includes a basic example application that can be used with the SDK. To run it from the main directory:

```bash
npm install --force
cd example
npm run android
npm run start -- --tunnel
```

An Expo server will start, from which you can open an Android build on your connected device.

## Publishing

1. Test using the example app.
2. Bump version in `package.json`.
3. `npm publish`
4. Create a new Tag and Release on GitHub please.
