# LingoSync Translator - Sidecar Chrome Extension

A free, open-source, real-time two-person audio translator that works alongside ChatGPT voice plugins.

## Architecture

This is the **SIDECAR** application. It works alongside the main Zubi voice plugin repository at:
`https://jules.google.com/repo/github/DigitalDemocracyInitiative/Dia-lingo-easy-translator/overview`

**DO NOT MODIFY** the main Zubi repository. This sidecar extension intercepts and processes voice input without touching the base plugin code.

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `Dia-lingo-easy-translator-sidecar-second-application-also-required-` directory

## Usage

1. Open ChatGPT (chat.openai.com) with a voice plugin (e.g., Zubi) active
2. Click the LingoSync extension icon in your toolbar
3. Click "Start Session"
4. Speaker A: Say a greeting in your language
5. Wait for confirmation
6. Speaker B: Say a greeting in your language
7. Begin alternating turns in your conversation

## Critical Warnings

⚠️ **Translation Accuracy**: Not suitable for legal, medical, or safety-critical use
🔒 **Privacy**: All audio is sent to OpenAI servers
🎭 **Context**: Cannot convey tone, sarcasm, or cultural nuance
⏱️ **Turn-Taking**: Do not interrupt or overlap speech
🔄 **Fragility**: Refresh requires restarting setup

## Technical Architecture

LingoSync is a "sidecar" extension that:
- Does NOT modify the base ChatGPT voice plugin
- Intercepts voice-to-text output
- Injects constrained translation prompts
- Enforces strict turn-taking protocol

## License

MIT License - Free for personal and commercial use