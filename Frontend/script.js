// ===== J.A.R.V.I.S. SYSTEM =====

// Get HTML elements
const chat = document.getElementById("chat");
const msg = document.getElementById("msg");
const send = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");

// ===== DISPLAY MESSAGE =====

function addMessage(text, sender) {
    const div = document.createElement("div");

    div.className = "message " +
        (sender === "user" ? "user-message" : "jarvis-message");

    div.textContent =
        (sender === "user" ? "YOU: " : "J.A.R.V.I.S: ") + text;

    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// ===== VOICE OUTPUT =====

function speak(text) {
    if (!("speechSynthesis" in window)) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 0.85;

    speechSynthesis.speak(utterance);
}

// ===== 1. TIME =====

async function handleTools(text) {

    const t = text.toLowerCase().trim();

    // TIME
    if (
        /\btime\b/.test(t) ||
        t.includes("టైమ్") ||
        t.includes("సమయం")
    ) {
        return "The time is " +
            new Date().toLocaleTimeString("en-IN") +
            ", Boss.";
    }

    // ===== 2. WEATHER =====

    if (
        t.includes("weather") ||
        t.includes("వాతావరణం")
    ) {

        return new Promise((resolve) => {

            if (!navigator.geolocation) {
                resolve("Location is not supported, Boss.");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (p) => {

                    try {

                        const url =
                            "https://api.open-meteo.com/v1/forecast?latitude=" +
                            p.coords.latitude +
                            "&longitude=" +
                            p.coords.longitude +
                            "&current_weather=true";

                        const r = await fetch(url);

                        if (!r.ok) {
                            throw new Error("Weather error");
                        }

                        const d = await r.json();

                        resolve(
                            "Current temperature is " +
                            d.current_weather.temperature +
                            " degrees Celsius, Boss."
                        );

                    } catch (e) {

                        resolve("Weather service unavailable, Boss.");

                    }
                },

                () => {
                    resolve(
                        "Please allow location permission for weather, Boss."
                    );
                }
            );
        });
    }

    // ===== 3. TIMER =====

    const m = t.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i
    );

    if (
        (t.includes("timer") || t.includes("టైమర్")) &&
        m
    ) {

        const amount = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();

        let factor = 1000;

        if (/^(minutes?|mins?)$/.test(unit)) {
            factor = 60000;
        }

        if (/^(hours?|hrs?)$/.test(unit)) {
            factor = 3600000;
        }

        const duration = amount * factor;

        setTimeout(() => {

            const message =
                "Boss, " + amount + " " + unit +
                " timer finished.";

            addMessage(message, "jarvis");
            speak(message);

        }, duration);

        return "Timer set for " +
            amount + " " + unit + ", Boss.";
    }

    // ===== 4. TRANSLATE TO TELUGU =====

    if (
        t.includes("translate") ||
        t.includes("అనువదించు")
    ) {

        const q = text
            .replace(/^translate(?:\s+this)?\s*/i, "")
            .replace(/^అనువదించు\s*/i, "")
            .trim();

        if (!q) {
            return "Tell me what you want to translate, Boss.";
        }

        try {

            const url =
                "https://api.mymemory.translated.net/get?q=" +
                encodeURIComponent(q) +
                "&langpair=en|te";

            const r = await fetch(url);

            if (!r.ok) {
                throw new Error("Translation error");
            }

            const d = await r.json();

            return "In Telugu: " +
                d.responseData.translatedText;

        } catch (e) {

            return "Translation service error, Boss.";

        }
    }

    // ===== 5. YOUTUBE =====

    if (
        t.startsWith("play ") ||
        t.includes("youtube")
    ) {

        const q = text
            .replace(/^play\s*/i, "")
            .replace(/^youtube\s*/i, "")
            .trim();

        if (!q) {
            return "What should I search on YouTube, Boss?";
        }

        const url =
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(q);

        window.open(url, "_blank");

        return "Searching YouTube for " + q + ", Boss.";
    }

    // ===== OTHER COMMANDS =====

    if (t.includes("hello") || t.includes("hi jarvis")) {
        return "Hello, Boss. All systems are operational.";
    }

    if (t.includes("who are you")) {
        return "I am J.A.R.V.I.S., your personal browser assistant.";
    }

    if (t.includes("how are you")) {
        return "All systems are functioning normally, Boss.";
    }

    if (t.includes("thank")) {
        return "Always at your service, Boss.";
    }

    if (t.includes("help") || t.includes("commands")) {
        return "You can ask for time, weather, timers, Telugu translation, YouTube searches, or say hello.";
    }

    // ===== UNKNOWN COMMAND =====

    return "I couldn't understand that command, Boss. Type HELP to see my available commands.";
}

// ===== COMMAND PROCESSOR =====

async function processCommand() {

    const text = msg.value.trim();

    if (!text) return;

    addMessage(text, "user");

    msg.value = "";

    addMessage("Processing command...", "jarvis");

    const lastMessage = chat.lastElementChild;

    try {

        const response = await handleTools(text);

        lastMessage.remove();

        addMessage(response || "Command completed.", "jarvis");

        speak(response || "Command completed.");

    } catch (e) {

        lastMessage.remove();

        const error = "System error. Please try again, Boss.";

        addMessage(error, "jarvis");

        speak(error);

        console.error(e);
    }
}

// ===== SEND BUTTON =====

send.addEventListener("click", processCommand);

// ===== ENTER KEY =====

msg.addEventListener("keydown", (e) => {

    if (e.key === "Enter") {
        processCommand();
    }
});

// ===== VOICE INPUT =====

micBtn.addEventListener("click", () => {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        addMessage(
            "Voice recognition is not supported in this browser.",
            "jarvis"
        );

        return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        addMessage("Listening, Boss...", "jarvis");
    };

    recognition.onresult = (event) => {

        const spokenText =
            event.results[0][0].transcript;

        msg.value = spokenText;

        processCommand();
    };

    recognition.onerror = () => {
        addMessage("Voice recognition error.", "jarvis");
    };

    recognition.start();
});

// ===== IMAGE UPLOAD =====

camBtn.addEventListener("click", () => {
    imgInput.click();
});

imgInput.addEventListener("change", () => {

    const file = imgInput.files[0];

    if (!file) return;

    addMessage(
        "Image selected: " + file.name +
        ". Image analysis requires an AI vision service.",
        "jarvis"
    );

    imgInput.value = "";
});

// ===== CLEAR CHAT =====

clearBtn.addEventListener("click", () => {

    chat.innerHTML = "";

    addMessage(
        "Chat cleared. Systems remain operational, Boss.",
        "jarvis"
    );

});

// ===== STARTUP =====

addMessage(
    "J.A.R.V.I.S. online. Awaiting your command, Boss.",
    "jarvis"
);

console.log("J.A.R.V.I.S. initialized successfully.");
