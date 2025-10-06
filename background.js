// background.js - LingoSync State Management v1.1

importScripts('prompts.js');

const CONVERSATION_STATE = {
    INACTIVE: 'INACTIVE',
    SETUP: 'SETUP',
    ACTIVE: 'ACTIVE'
};

let currentState = CONVERSATION_STATE.INACTIVE;
let languageA = null;
let languageB = null;
let currentSpeaker = 'A';
let turnCount = 0;
let sessionActive = false;

// NEW: Track setup steps and store introductions
let setupStep = 0;
let languageA_intro = '';
let languageB_intro = '';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === 'START_SESSION') {
        currentState = CONVERSATION_STATE.SETUP;
        languageA = null;
        languageB = null;
        currentSpeaker = 'A';
        turnCount = 0;
        sessionActive = true;
        setupStep = 0;
        languageA_intro = '';
        languageB_intro = '';

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
            active: sessionActive,
            setupStep: setupStep
        });
    }

    else if (request.action === 'PROCESS_SPOKEN_INPUT') {
        const spokenText = request.text;
        let responsePrompt = '';

        if (currentState === CONVERSATION_STATE.SETUP) {

            if (setupStep === 0) {
                // Speaker A introduction
                languageA_intro = spokenText;
                responsePrompt = spokenText;

            } else if (setupStep === 1) {
                // Speaker B introduction
                languageB_intro = spokenText;
                responsePrompt = spokenText;

            } else if (setupStep === 2) {
                // Artificial prompt for cross-translation confirmation
                responsePrompt = `PROTOCOL STEP 3: Translate the following introductions and output ONLY the translations separated by pipe "|":
Language A Intro: "${languageA_intro}"
Language B Intro: "${languageB_intro}"
Language A is: ${languageA}
Language B is: ${languageB}
Output format: [A intro in Language B] | [B intro in Language A]`;
            }

            sendResponse({ prompt: responsePrompt });

        } else if (currentState === CONVERSATION_STATE.ACTIVE) {
            const sourceLang = (currentSpeaker === 'A') ? languageA : languageB;
            const targetLang = (currentSpeaker === 'A') ? languageB : languageA;

            responsePrompt = TRANSLATION_PROMPT_WRAPPER(spokenText, sourceLang, targetLang);

            currentSpeaker = (currentSpeaker === 'A') ? 'B' : 'A';
            turnCount++;

            if (turnCount % 10 === 0) {
                responsePrompt = EMERGENCY_REINFORCEMENT + '\n\n' + responsePrompt;
            }

            sendResponse({ prompt: responsePrompt });
        } else {
            sendResponse({ error: 'Session not active' });
        }
    }

    else if (request.action === 'HANDLE_LLM_RESPONSE') {
        const llmOutput = request.text;

        if (currentState === CONVERSATION_STATE.SETUP) {

            if (setupStep === 0) {
                // Parse first language detection
                try {
                    const parsed = JSON.parse(llmOutput.trim());
                    if (parsed.detected_language && parsed.ready === false) {
                        languageA = parsed.detected_language;
                        setupStep = 1;
                        sendResponse({
                            success: true,
                            message: `Language A detected: ${languageA}`,
                            continueSetup: true
                        });
                    }
                } catch (e) {
                    console.error('LingoSync: Failed to parse Step 0 JSON', e);
                    sendResponse({ error: 'Language A detection failed' });
                }

            } else if (setupStep === 1) {
                // Parse second language detection
                try {
                    const parsed = JSON.parse(llmOutput.trim());
                    if (parsed.language_a && parsed.language_b && parsed.ready === true) {
                        languageA = parsed.language_a;
                        languageB = parsed.language_b;
                        setupStep = 2;
                        sendResponse({
                            success: true,
                            message: `Languages detected: ${languageA} ↔ ${languageB}`,
                            setupNeedsFinalStep: true
                        });
                    }
                } catch (e) {
                    console.error('LingoSync: Failed to parse Step 1 JSON', e);
                    sendResponse({ error: 'Language B detection failed' });
                }

            } else if (setupStep === 2) {
                // Receive cross-translation confirmation
                if (llmOutput.includes('|')) {
                    currentState = CONVERSATION_STATE.ACTIVE;
                    setupStep = 3;
                    sendResponse({
                        success: true,
                        setupComplete: true,
                        finalConfirmation: llmOutput
                    });
                } else {
                    console.error('LingoSync: Step 2 did not produce pipe-separated translations');
                    sendResponse({ error: 'Setup confirmation failed' });
                }
            }

        } else if (currentState === CONVERSATION_STATE.ACTIVE) {
            if (detectProtocolViolation(llmOutput)) {
                console.error('LingoSync: PROTOCOL VIOLATION - Injecting emergency reinforcement');
                sendResponse({
                    violation: true,
                    text: llmOutput,
                    needsReinforcement: true
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
        setupStep = 0;
        languageA_intro = '';
        languageB_intro = '';

        sendResponse({ success: true });
    }

    return true;
});

chrome.storage.local.set({
    lingosync_state: {
        active: false,
        lastUpdate: Date.now()
    }
});