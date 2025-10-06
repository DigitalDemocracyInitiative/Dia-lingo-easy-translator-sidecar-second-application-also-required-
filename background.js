// background.js - LingoSync State Management

importScripts('prompts.js');

// Conversation states
const CONVERSATION_STATE = {
    INACTIVE: 'INACTIVE',
    SETUP: 'SETUP',
    ACTIVE: 'ACTIVE'
};

// Session state
let currentState = CONVERSATION_STATE.INACTIVE;
let languageA = null;
let languageB = null;
let currentSpeaker = 'A';
let turnCount = 0;
let sessionActive = false;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === 'START_SESSION') {
        // Reset and initialize new session
        currentState = CONVERSATION_STATE.SETUP;
        languageA = null;
        languageB = null;
        currentSpeaker = 'A';
        turnCount = 0;
        sessionActive = true;

        sendResponse({
            success: true,
            prompt: INITIAL_SYSTEM_PROMPT
        });
    }

    else if (request.action === 'GET_SESSION_STATE') {
        sendResponse({
            state: currentState,
            languageA: languageA,
            languageB: languageB,
            active: sessionActive
        });
    }

    else if (request.action === 'PROCESS_SPOKEN_INPUT') {
        const spokenText = request.text;
        let responsePrompt = '';

        if (currentState === CONVERSATION_STATE.SETUP) {
            // During setup, just pass through the spoken text
            // The LLM will respond with JSON that we parse in HANDLE_LLM_RESPONSE
            responsePrompt = spokenText;
            sendResponse({ prompt: responsePrompt });

        } else if (currentState === CONVERSATION_STATE.ACTIVE) {
            // Determine source and target languages based on current speaker
            const sourceLang = (currentSpeaker === 'A') ? languageA : languageB;
            const targetLang = (currentSpeaker === 'A') ? languageB : languageA;

            // Generate constrained translation prompt
            responsePrompt = TRANSLATION_PROMPT_WRAPPER(spokenText, sourceLang, targetLang);

            // Flip speaker for next turn
            currentSpeaker = (currentSpeaker === 'A') ? 'B' : 'A';
            turnCount++;

            sendResponse({ prompt: responsePrompt });
        } else {
            sendResponse({ error: 'Session not active' });
        }
    }

    else if (request.action === 'HANDLE_LLM_RESPONSE') {
        const llmOutput = request.text;

        if (currentState === CONVERSATION_STATE.SETUP) {
            // Parse JSON response for language detection
            try {
                const parsed = JSON.parse(llmOutput.trim());

                if (parsed.ready === false && !languageA) {
                    languageA = parsed.detected_language;
                    sendResponse({
                        success: true,
                        message: `Language A detected: ${languageA}`
                    });

                } else if (parsed.ready === true && languageA && !languageB) {
                    languageB = parsed.language_b;
                    currentState = CONVERSATION_STATE.ACTIVE;

                    sendResponse({
                        success: true,
                        message: `Translation active: ${languageA} ↔ ${languageB}`,
                        setupComplete: true
                    });
                }
            } catch (e) {
                console.error('LingoSync: Failed to parse setup JSON', e);
                sendResponse({
                    error: 'Language detection failed',
                    needsRetry: true
                });
            }

        } else if (currentState === CONVERSATION_STATE.ACTIVE) {
            // ENHANCED: Check for protocol violations
            if (detectProtocolViolation(llmOutput)) {
                console.error('LingoSync: PROTOCOL VIOLATION - Injecting emergency reinforcement');

                // Send emergency reinforcement back to content script
                sendResponse({
                    violation: true,
                    text: llmOutput,
                    needsReinforcement: true  // NEW FLAG
                });
            } else {
                sendResponse({
                    success: true,
                    text: llmOutput
                });
            }
        }
    }

    else if (request.action === 'STOP_SESSION') {
        currentState = CONVERSATION_STATE.INACTIVE;
        sessionActive = false;
        languageA = null;
        languageB = null;
        turnCount = 0;

        sendResponse({ success: true });
    }

    return true; // Keep message channel open for async responses
});

// Storage sync for persistence across sessions
chrome.storage.local.set({
    lingosync_state: {
        active: false,
        lastUpdate: Date.now()
    }
});