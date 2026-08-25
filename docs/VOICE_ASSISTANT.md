# Voice assistant — physical Xiaomi remote

Current vertical slice:

`voice button -> remote_daemon -> Termux microphone -> ADB -> PC -> ffmpeg WAV -> AssemblyAI Sync -> OpenRouter openrouter/free -> semantic command registry -> ADB/intents -> MeuJW/TV`

## Secrets

Create/update `.env` in the project root:

```text
ASSEMBLYAI_API_KEY=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free

# The existing aliases AssemblyAIAPI and OpenRouterFreeAPI are also accepted.
```

The keys stay on the PC. They are not compiled into the Android application.

## Runtime

`tools/start_meujw.ps1` already discovers the Xiaomi. It passes the resolved ADB executable and TV serial to the Python server through `MEUJW_ADB_PATH` and `MEUJW_TV_SERIAL`.

When both API keys are configured, the server starts the remote listener automatically. The voice button DOWN starts a Termux AAC/M4A recording and temporarily grabs the physical remote; UP stops the recording, releases the remote, pulls the clip to the PC and converts it to mono 16 kHz PCM WAV.

The WAV is sent in one request to AssemblyAI Sync. The transcript is sent to OpenRouter with only the registered semantic tools. There is no generic ADB/shell tool exposed to the model.

## Current semantic tools

- `meujw.open_home`
- `meujw.open_section`
- `meujw.play_latest`
- `meujw.continue`
- `meujw.search`
- `player.pause`
- `player.resume`
- `player.stop`
- `player.seek`
- `tv.home`
- `tv.hdmi`
- `tv.youtube_open`
- `tv.youtube_search`

MeuJW playback commands are delivered as semantic Android intents to the existing `MainActivity`, so ExoPlayer decides whether it is playing/paused and performs seek itself.

## Local diagnostics

- `GET http://127.0.0.1:8765/api/assistant/status`
- `POST http://127.0.0.1:8765/api/assistant/text` with JSON `{ "text": "abre a adoração matinal mais recente" }`

The text endpoint is localhost-only and is intended to test the OpenRouter/command side without using the microphone.

## TV prerequisites inherited from Xiaomi_Adb

- ADB over the network
- Termux installed
- Termux:API installed and microphone permission granted
- the known physical remote input device (default `/dev/input/event3`)

The copied Rust `remote_daemon` is uploaded automatically to `/data/local/tmp/meujw_remote_daemon` if absent.
