// content.js - LingoSync Content Script (ChatGPT Integration)

// Selectors for ChatGPT UI elements (may need adjustment for different versions)
const SELECTORS = {
    textarea: 'textarea[data-id="root"]',
    textareaFallback: '#prompt-textarea',
    submitButton: 'button[data-testid="send-button"]',
    messageContainer: '.text-base'
};

// State tracking
let lastProcessedInput = '';
let lastProcessedOutput = '';
let observerActive = false;
let sessionInitialized = false;

// Find ChatGPT UI elements with fallback logic
function findChatElements() {
    const textarea = document.querySelector(SELECTORS.textarea) ||
                     document.querySelector(SELECTORS.textareaFallback) ||
                     document.querySelector('textarea');

    const submitButton = document.querySelector(SELECTORS.submitButton) ||
                         document.querySelector('button[aria-label="Send prompt"]');

    return { textarea, submitButton };
}

// Simulate input events to trigger ChatGPT's event listeners
function simulateInput(element, text) {
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Check if text should be processed (avoid processing our own injections)
function shouldProcessText(text) {
    return text.length > 0
        && text !== lastProcessedInput
        && !text.startsWith('TRANSLATION PROTOCOL')
        && !text.startsWith('Translate from')
        && !text.includes('{"detected_language"')
        && !text.includes('PROTOCOL REMINDER');
}

// Main interception logic
function interceptAndProcessInput(spokenText) {
    const { textarea, submitButton } = findChatElements();

    if (!textarea || !submitButton) {
        console.error('LingoSync: Could not find ChatGPT UI elements');
        return;
    }

    lastProcessedInput = spokenText;

    // Send spoken text to background script for prompt generation
    chrome.runtime.sendMessage({
        action: 'PROCESS_SPOKEN_INPUT',
        text: spokenText
    }, (response) => {
        if (response && response.prompt) {
            // Clear textarea first
            simulateInput(textarea, '');

            // Inject constrained translation prompt
            setTimeout(() => {
                simulateInput(textarea, response.prompt);

                // Submit to LLM
                setTimeout(() => {
                    submitButton.click();
                }, 50);
            }, 100);
        }
    });
}

// Observe textarea for Zubi plugin voice input
const inputObserver = new MutationObserver(() => {
    const { textarea } = findChatElements();
    if (!textarea) return;

    const currentText = textarea.value.trim();

    if (shouldProcessText(currentText)) {
        // Clear immediately to prevent Zubi from submitting
        const capturedText = currentText;
        simulateInput(textarea, '');

        // Process after brief delay
        setTimeout(() => {
            interceptAndProcessInput(capturedText);
        }, 50);
    }
});

// Observe chat messages for LLM responses
const outputObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            const messages = document.querySelectorAll(SELECTORS.messageContainer);
            const lastMessage = messages[messages.length - 1];

            if (lastMessage) {
                const messageText = lastMessage.textContent.trim();

                if (messageText !== lastProcessedOutput && messageText.length > 0) {
                    lastProcessedOutput = messageText;

                    chrome.runtime.sendMessage({
                        action: 'HANDLE_LLM_RESPONSE',
                        text: messageText
                    }, (response) => {
                        if (response && response.setupComplete) {
                            console.log('LingoSync: Setup complete, translation active');
                        }

                        // NEW: Auto-inject reinforcement if violation detected
                        if (response && response.needsReinforcement) {
                            console.warn('LingoSync: Violation detected - sending emergency reinforcement');

                            const { textarea, submitButton } = findChatElements();
                            if (textarea && submitButton) {
                                // Import EMERGENCY_REINFORCEMENT from prompts.js
                                const reinforcement = `CRITICAL ERROR DETECTED: You are generating conversational responses.
STOP IMMEDIATELY.
You are a translation machine.
Your next output must be ONLY the translation of the input text.
NO greetings, NO questions, NO conversation continuation.
ONLY the translated text.`;

                                setTimeout(() => {
                                    simulateInput(textarea, reinforcement);
                                    setTimeout(() => {
                                        submitButton.click();
                                    }, 50);
                                }, 500);
                            }
                        }
                    });
                }
            }
        }
    }
});

// Initialize LingoSync when page is ready
function initLingoSync() {
    const { textarea } = findChatElements();

    if (!textarea) {
        // Retry if elements not found
        setTimeout(initLingoSync, 1000);
        return;
    }

    // Request session start from background
    chrome.runtime.sendMessage({ action: 'START_SESSION' }, (response) => {
        if (response && response.prompt) {
            sessionInitialized = true;

            // Inject initial system prompt
            simulateInput(textarea, response.prompt);

            setTimeout(() => {
                const { submitButton } = findChatElements();
                if (submitButton) {
                    submitButton.click();
                }
            }, 100);

            // Start observing textarea for voice input
            inputObserver.observe(textarea, {
                attributes: true,
                attributeFilter: ['value'],
                characterData: true,
                subtree: true
            });

            // Start observing chat container for LLM responses
            const chatContainer = document.querySelector('main') || document.body;
            outputObserver.observe(chatContainer, {
                childList: true,
                subtree: true
            });

            console.log('LingoSync: Sidecar initialized and observing');
        }
    });
}

// Listen for emergency reset from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'INJECT_EMERGENCY_REINFORCEMENT') {
        const { textarea, submitButton } = findChatElements();
        if (textarea && submitButton) {
            const reinforcement = `CRITICAL ERROR DETECTED: You are generating conversational responses.
STOP IMMEDIATELY.
You are a translation machine.
Your next output must be ONLY the translation of the input text.
NO greetings, NO questions, NO conversation continuation.
ONLY the translated text.`;

            simulateInput(textarea, reinforcement);
            setTimeout(() => {
                submitButton.click();
                sendResponse({success: true});
            }, 50);
        } else {
            sendResponse({success: false, error: "Could not find chat elements"});
        }
        return true; // Keep message channel open for async response
    }
});

// Auto-start when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLingoSync);
} else {
    initLingoSync();
}