
/* =====================================================
   1. J.A.R.V.I.S. - API KEY AND MODELS
===================================================== */

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    }
}

const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest"
];


/* =====================================================
   2. MEMORY
===================================================== */

let MEMORY = [];
let FACTS = [];

try {
    MEMORY = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );

    FACTS = JSON.parse(
        localStorage.getItem("jarvis_facts") || "[]"
    );

    if (!Array.isArray(MEMORY)) MEMORY = [];
    if (!Array.isArray(FACTS)) FACTS = [];

} catch (error) {
    MEMORY = [];
    FACTS = [];
}

function saveMemory() {
    localStorage.setItem(
        "jarvis_memory",
        JSON.stringify(MEMORY)
    );

    localStorage.setItem(
        "jarvis_facts",
        JSON.stringify(FACTS)
    );
}

function remember(text, role) {
    MEMORY.push({
        role: role === "user" ? "user" : "model",
        text: String(text)
    });

    if (MEMORY.length > 40) {
        MEMORY = MEMORY.slice(-40);
    }

    saveMemory();
}

function saveFact(text) {
    FACTS.push(String(text));

    if (FACTS.length > 100) {
        FACTS = FACTS.slice(-100);
    }

    saveMemory();
}


/* =====================================================
   3. CONNECT HTML
===================================================== */

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");

const coreText = document.getElementById("core-text");
const aiStatus = document.getElementById("ai-status");
const connectionStatus = document.getElementById("connection-status");
const voiceStatus = document.getElementById("voice-status");
const memoryStatus = document.getElementById("memory-status");


/* =====================================================
   4. CHAT DISPLAY
===================================================== */

function add(text, role = "ai") {
    const div = document.createElement("div");

    div.className =
        "message " +
        (role === "user"
            ? "user-message"
            : "jarvis-message");

    div.textContent =
        (role === "user" ? "YOU: " : "J.A.R.V.I.S: ") +
        text;

    chat.appendChild(div);

    chat.scrollTop = chat.scrollHeight;
}

function restoreChat() {
    chat.innerHTML = "";

    MEMORY.forEach(message => {
        add(
            message.text,
            message.role === "user" ? "user" : "ai"
        );
    });
}

restoreChat();


/* =====================================================
   5. STATUS
===================================================== */

function setStatus(message) {
    coreText.textContent = message;
}

function setBusy(busy) {
    sendBtn.disabled = busy;
    camBtn.disabled = busy;
    sendBtn.textContent = busy ? "PROCESSING..." : "EXECUTE";

    aiStatus.textContent = busy
        ? "● PROCESSING"
        : "● READY";

    setStatus(busy ? "PROCESSING..." : "SYSTEM READY");
}


/* =====================================================
   6. TEXT TO SPEECH
===================================================== */

function speak(text) {
    if (!("speechSynthesis" in window)) return;

    speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";
    speech.rate = 1;
    speech.pitch = 0.85;

    speechSynthesis.speak(speech);
}


/* =====================================================
   7. GEMINI API
===================================================== */

async function callGemini(prompt, image = null) {

    if (!API_KEY) {
        throw new Error("API key missing. Reload the page.");
    }

    const history = [];

    // Keep history valid for Gemini
    MEMORY.slice(-20).forEach(m => {

        if (
            !m ||
            !["user", "model"].includes(m.role) ||
            typeof m.text !== "string"
        ) {
            return;
        }

        const last = history[history.length - 1];

        // Gemini history should alternate roles
        if (last && last.role === m.role) {
            last.parts[0].text += "\n" + m.text;
        } else {
            history.push({
                role: m.role,
                parts: [{ text: m.text }]
            });
        }
    });

    // Remove a final user message from history
    // if it is already the current prompt
    if (history.length && history[history.length - 1].role === "user") {
        history.pop();
    }

    const factContext = FACTS.length
        ? "Facts remembered about the user:\n" +
          FACTS.map(f => "- " + f).join("\n")
        : "No saved facts yet.";

    const systemContext =
        "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
        "Address the user politely. Use the saved facts when relevant. " +
        "If the user asks you to remember a fact, acknowledge it. " +
        "Do not claim to have performed an action you did not perform.\n\n" +
        factContext;

    const currentParts = [
        {
            text: systemContext + "\n\nUser request: " + prompt
        }
    ];

    if (image) {
        currentParts.push({
            inline_data: {
                mime_type: image.mimeType,
                data: image.data
            }
        });
    }

    history.push({
        role: "user",
        parts: currentParts
    });

    let lastError = "";

    for (const model of MODELS) {

        try {

            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent";

            const response = await fetch(url, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": API_KEY
                },

                body: JSON.stringify({
                    contents: history,
                    generationConfig: {
                        maxOutputTokens: 1500
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage =
                    data?.error?.message ||
                    ("HTTP " + response.status);

                lastError = errorMessage;

                // Try next model for model errors
                continue;
            }

            const answer =
                data?.candidates?.[0]?.content?.parts
                    ?.map(p => p.text || "")
                    .join("")
                    .trim();

            if (answer) {
                return answer;
            }

            lastError = "Gemini returned an empty response.";

        } catch (error) {
            lastError = error.message;
        }
    }

    throw new Error(lastError || "All Gemini models failed.");
}


/* =====================================================
   8. DIRECT COMMAND TOOLS
===================================================== */

async function handleTools(text) {

    const t = text.toLowerCase().trim();

    // TIME
    if (/\b(time|clock)\b/.test(t)) {
        return "The current time is " +
            new Date().toLocaleTimeString("en-IN");
    }

    // DATE
    if (/\b(date|today|day)\b/.test(t)) {
        return "Today is " +
            new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            });
    }

    // OPEN YOUTUBE
    if (/^(open\s+)?youtube$/i.test(t)) {
        window.open(
            "https://www.youtube.com/",
            "_blank"
        );

        return "Opening YouTube.";
    }

    // OPEN GOOGLE
    if (/^(open\s+)?google$/i.test(t)) {
        window.open(
            "https://www.google.com/",
            "_blank"
        );

        return "Opening Google.";
    }

    // OPEN URL
    const urlMatch = text.match(
        /^(open|visit|go to)\s+(https?:\/\/\S+)$/i
    );

    if (urlMatch) {
        try {
            const url = new URL(urlMatch[2]);

            if (!["https:", "http:"].includes(url.protocol)) {
                return "Invalid URL.";
            }

            window.open(url.href, "_blank");

            return "Opening " + url.hostname;
        } catch (e) {
            return "Invalid link.";
        }
    }

    // GOOGLE SEARCH
    const googleMatch = text.match(
        /^(google search|search google|search on google|search google for)\s+(.+)$/i
    );

    if (googleMatch) {
        const query = googleMatch[2];

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching Google for " + query;
    }

    // YOUTUBE SEARCH
    const youtubeMatch = text.match(
        /^(play|youtube search|youtube|search youtube for)\s+(.+)$/i
    );

    if (youtubeMatch) {
        const query = youtubeMatch[2];

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching YouTube for " + query;
    }

    // NEWS
    if (t.includes("news")) {
        window.open(
            "https://news.google.com/search?q=" +
            encodeURIComponent(text),
            "_blank"
        );

        return "Opening news.";
    }

    // CALCULATOR
    if (t.includes("calculator")) {
        window.open(
            "https://www.google.com/search?q=calculator",
            "_blank"
        );

        return "Opening calculator.";
    }

    // CRYPTO
    if (
        t.includes("bitcoin") ||
        t.includes("crypto") ||
        t.includes("btc")
    ) {
        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(text),
            "_blank"
        );

        return "Opening cryptocurrency information.";
    }

    // TIMER
    const timerMatch = t.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/
    );

    if (t.includes("timer") && timerMatch) {

        const amount = Number(timerMatch[1]);
        const unit = timerMatch[2];

        let factor = 1000;

        if (/minutes?|mins?/.test(unit)) {
            factor = 60000;
        }

        if (/hours?|hrs?/.test(unit)) {
            factor = 3600000;
        }

        setTimeout(() => {
            const message =
                "Your " + amount + " " + unit +
                " timer has finished.";

            add(message, "ai");
            speak(message);
        }, amount * factor);

        return "Timer set for " + amount + " " + unit + ".";
    }

    // HELP
    if (t === "help" || t.includes("available commands")) {
        return "Commands: time, date, weather, timer, translate, " +
            "Google search, YouTube, news, calculator, " +
            "crypto, or ask me anything.";
    }

    // WEATHER
    if (t.includes("weather")) {

        return new Promise(resolve => {

            if (!navigator.geolocation) {
                resolve("Location is not supported.");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async position => {

                    try {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;

                        const url =
                            "https://api.open-meteo.com/v1/forecast?" +
                            "latitude=" + lat +
                            "&longitude=" + lon +
                            "&current_weather=true";

                        const response = await fetch(url);

                        if (!response.ok) {
                            throw new Error("Weather request failed");
                        }

                        const data = await response.json();

                        resolve(
                            "Current temperature is " +
                            data.current_weather.temperature +
                            " degrees Celsius."
                        );

                    } catch (e) {
                        resolve("Weather service error.");
                    }
                },

                () => resolve("Please allow location permission.")
            );
        });
    }

    // TRANSLATE TO TELUGU
    if (t.startsWith("translate")) {

        const q = text.replace(
            /^translate\s*/i,
            ""
        ).trim();

        if (!q) {
            return "Please enter text to translate.";
        }

        try {

            const url =
                "https://api.mymemory.translated.net/get?q=" +
                encodeURIComponent(q) +
                "&langpair=en|te";

            const response = await fetch(url);
            const data = await response.json();

            return "In Telugu: " +
                data.responseData.translatedText;

        } catch (e) {
            return "Translation service error.";
        }
    }

    return null;
}


/* =====================================================
   9. SAVE PERSONAL FACTS
===================================================== */

function detectFact(text) {

    const patterns = [
        /^my favourite .+ is .+$/i,
        /^my favorite .+ is .+$/i,
        /^remember that .+$/i,
        /^remember .+$/i,
        /^i like .+$/i,
        /^i love .+$/i,
        /^my name is .+$/i,
        /^i live in .+$/i,
        /^i am from .+$/i
    ];

    return patterns.some(pattern => pattern.test(text.trim()));
}


/* =====================================================
   10. MAIN COMMAND
===================================================== */

async function processCommand() {

    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    add(text, "user");

    remember(text, "user");

    setBusy(true);

    try {

        // Save personal facts
        if (detectFact(text)) {
            saveFact(text);
        }

        // Direct commands
        const toolResult = await handleTools(text);

        if (toolResult !== null) {

            add(toolResult, "ai");
            remember(toolResult, "model");
            speak(toolResult);

            return;
        }

        // Gemini
        const answer = await callGemini(text);

        add(answer, "ai");
        remember(answer, "model");
        speak(answer);

    } catch (error) {

        console.error("JARVIS ERROR:", error);

        add(
            "Error: " + error.message +
            "\nCheck your API key, internet connection and model access.",
            "ai"
        );

    } finally {
        setBusy(false);
    }
}


/* =====================================================
   11. EXECUTE BUTTON
===================================================== */

sendBtn.addEventListener("click", processCommand);


/* =====================================================
   12. ENTER KEY
===================================================== */

input.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        event.preventDefault();
        processCommand();
    }
});


/* =====================================================
   13. VOICE INPUT
===================================================== */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;

if (SpeechRecognition) {

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = function() {
        voiceStatus.textContent = "● LISTENING";
        setStatus("LISTENING...");
        micBtn.textContent = "🔴";
    };

    recognition.onresult = function(event) {

        const transcript =
            event.results[0][0].transcript;

        input.value = transcript;

        voiceStatus.textContent = "● READY";

        processCommand();
    };

    recognition.onerror = function(event) {

        voiceStatus.textContent = "● ERROR";

        add(
            "Voice error: " + event.error,
            "ai"
        );
    };

    recognition.onend = function() {

        voiceStatus.textContent = "● READY";
        micBtn.textContent = "🎙️";
        setStatus("SYSTEM READY");
    };

} else {

    voiceStatus.textContent = "● NOT SUPPORTED";
}

micBtn.addEventListener("click", function() {

    if (!recognition) {

        add(
            "Voice recognition is not supported in this browser. " +
            "Try Google Chrome.",
            "ai"
        );

        return;
    }

    try {
        recognition.start();
    } catch (error) {
        recognition.stop();
    }
});


/* =====================================================
   14. CAMERA AND IMAGE
===================================================== */

camBtn.addEventListener("click", function() {
    imgInput.click();
});

imgInput.addEventListener("change", async function() {

    const file = imgInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        add("Please select an image file.", "ai");
        return;
    }

    add("Image selected: " + file.name, "user");

    setBusy(true);

    try {

        const reader = new FileReader();

        reader.onload = async function() {

            try {

                const base64 = String(reader.result)
                    .split(",")[1];

                const image = {
                    data: base64,
                    mimeType: file.type
                };

                const answer = await callGemini(
                    "Describe this image and answer what you see.",
                    image
                );

                add(answer, "ai");
                remember("Image analysis: " + answer, "model");
                speak(answer);

            } catch (error) {

                add(
                    "Image error: " + error.message,
                    "ai"
                );

            } finally {

                setBusy(false);
                imgInput.value = "";
            }
        };

        reader.onerror = function() {

            add("Could not read the image.", "ai");
            setBusy(false);
            imgInput.value = "";
        };

        reader.readAsDataURL(file);

    } catch (error) {

        add("Camera error: " + error.message, "ai");
        setBusy(false);
        imgInput.value = "";
    }
});


/* =====================================================
   15. CLEAR MEMORY
===================================================== */

clearBtn.addEventListener("click", function() {

    const confirmed = confirm(
        "Delete all chat history and saved facts?"
    );

    if (!confirmed) return;

    MEMORY = [];
    FACTS = [];

    localStorage.removeItem("jarvis_memory");
    localStorage.removeItem("jarvis_facts");

    chat.innerHTML = "";

    add(
        "Memory cleared. System ready.",
        "ai"
    );

    setStatus("MEMORY CLEARED");
});


/* =====================================================
   16. STARTUP
===================================================== */

console.log("J.A.R.V.I.S. loaded successfully.");

setStatus("SYSTEM READY");
