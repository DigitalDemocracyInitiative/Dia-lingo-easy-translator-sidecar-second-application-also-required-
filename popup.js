// popup.js - LingoSync Popup Controller

const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const langADisplay = document.getElementById('langA');
const langBDisplay = document.getElementById('langB');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

// Update UI from background state
function updateUI() {
    chrome.runtime.sendMessage({ action: 'GET_SESSION_STATE' }, (response) => {
        if (response) {
            if (response.active) {
                statusIndicator.classList.add('active');
                statusText.textContent = response.state === 'ACTIVE' ? 'Translating' : 'Setting up...';
                startBtn.disabled = true;
                stopBtn.disabled = false;

                langADisplay.textContent = response.languageA || 'Waiting...';
                langBDisplay.textContent = response.languageB || 'Waiting...';
            } else {
                statusIndicator.classList.remove('active');
                statusText.textContent = 'Inactive';
                startBtn.disabled = false;
                stopBtn.disabled = true;

                langADisplay.textContent = 'Not set';
                langBDisplay.textContent = 'Not set';
            }
        }
    });
}

// Start session
startBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'START_SESSION' }, () => {
        updateUI();
    });
});

// Stop session
stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'STOP_SESSION' }, () => {
        updateUI();
    });
});

// Update UI on popup open
updateUI();

// Refresh UI every 2 seconds while open
setInterval(updateUI, 2000);