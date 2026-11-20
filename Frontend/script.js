// ============================================================
// J.A.R.V.I.S. - COMPLETE UPDATED SCRIPT
// Chat, Retry, Fallback, Memory, Voice, Image and Tools
// ============================================================

// ==================== 1. API KEY ====================

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY && API_KEY.trim()) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    } else {
        API_KEY = "";
    }
}

// ==================== 2. MODEL FALLBACK ====================

// Try each model if the previous one fails.
const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest"
];

// ==================== 3. MEMORY ====================

let MEMORY = [];

try {
    MEMORY = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );

    if (!Array.isArray(MEMORY)) {
        MEMORY = [];
    }

    MEMORY = MEMORY.filter(
        item =>
            item &&
            (item.role === "user" || item.role === "model") &&
            typeof item.text === "string"
    );

} catch (error) {
    MEMORY = [];
}

function saveMemory() {
    try {
        localStorage.setItem(
            "jarvis_memory",
            JSON.stringify(MEMORY)
        );
    } catch (error) {
        console.error("Memory save error:", error);
    }
}

function remember(text, role) {
    MEMORY.push({
        role: role === "user" ? "user" : "model",
        text: String(text)
    });

    // Keep the latest 40 messages.
    if (MEMORY.length > 40) {
        MEMORY = MEMORY.slice(-40);
    }

    saveMemory();
}

// ==================== 4. HTML ELEMENTS ====================

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");

const coreText = document.getElementById("core-text");

// ==================== 5. CHAT DISPLAY ====================

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

    return div;
}

// Restore chat history.
MEMORY.forEach(item => {
    add(
        item.text,
        item.role === "user" ? "user" : "ai"
    );
});

// ==================== 6. STATUS ====================

function setStatus(text) {
    if (coreText) {
        coreText.textContent = text;
    }
}

function resetStatus() {
    setStatus("SYSTEM READY");
}

// ==================== 7. VOICE OUTPUT ====================

function speak(text) {
    if (!("speechSynthesis" in window)) {
        return;
    }

    speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";
    speech.rate = 1;
    speech.pitch = 0.9;

    speechSynthesis.speak(speech);
}

// ==================== 8. FETCH TIMEOUT ====================

async function fetchWithTimeout(
    url,
    options = {},
    timeout = 18000
) {
    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        timeout
    );

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });

    } finally {
        clearTimeout(timer);
    }
}

// ==================== 9. WAIT FUNCTION ====================

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 10. GEMINI ENGINE ====================

async function callGeminiRaw(prompt, imageBase64 = null, mimeType = null) {

    if (!API_KEY) {
        throw new Error(
            "API key missing. Reload the page and enter your API key."
        );
    }

    // Build conversation history.
    const contents = MEMORY.slice(-12).map(item => ({
        role: item.role,
        parts: [
            {
                text: item.text
            }
        ]
    }));

    // Add current request.
    const parts = [
        {
            text: prompt
        }
    ];

    // Add image if supplied.
    if (imageBase64 && mimeType) {
        parts.push({
            inline_data: {
                mime_type: mimeType,
                data: imageBase64
            }
        });
    }

    contents.push({
        role: "user",
        parts: parts
    });

    let lastError = null;

    // Try each model.
    for (const model of MODELS) {

        // Retry each model up to 2 times.
        for (let attempt = 1; attempt <= 2; attempt++) {

            try {

                setStatus(
                    "CONNECTING: " + model
                );

                const url =
                    "https://generativelanguage.googleapis.com/v1beta/models/" +
                    model +
                    ":generateContent";

                const response = await fetchWithTimeout(
                    url,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": API_KEY
                        },

                        body: JSON.stringify({
                            contents: contents,

                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 1200
                            }
                        })
                    },
                    18000
                );

                const data = await response.json();

                // API error.
                if (!response.ok) {

                    const message =
                        data?.error?.message ||
                        "API error " + response.status;

                    const error = new Error(message);

                    error.status = response.status;

                    throw error;
                }

                // Extract answer.
                const answer =
                    data?.candidates?.[0]?.content?.parts
                        ?.map(part => part.text || "")
                        .join("")
                        .trim();

                if (answer) {
                    return answer;
                }

                throw new Error(
                    "Gemini returned an empty response."
                );

            } catch (error) {

                lastError = error;

                console.error(
                    "Gemini failed:",
                    model,
                    "Attempt:",
                    attempt,
                    error
                );

                // Retry temporary errors.
                const retryable =
                    error.status === 503 ||
                    error.status === 429 ||
                    error.status === 500 ||
                    error.status === 502 ||
                    error.status === 504 ||
                    error.name === "AbortError" ||
                    !error.status;

                if (!retryable) {
                    // Try another model for model-related errors.
                    break;
                }

                if (attempt < 2) {
                    setStatus("RETRYING CONNECTION...");
                    await wait(1000 * attempt);
                }
            }
        }
    }

    // Every model failed.
    throw new Error(
        lastError?.message ||
        "All Gemini models are unavailable."
    );
}

// ==================== 11. GEMINI CHAT ====================

async function callGemini(prompt) {
    return await callGeminiRaw(prompt);
}

// ==================== 12. TOOLS ====================

async function handleTools(text) {

    const t = text.toLowerCase().trim();

    // ---------- TIME ----------

    if (/\b(time|clock)\b/.test(t)) {

        return "The current time is " +
            new Date().toLocaleTimeString("en-IN") +
            ", Boss.";
    }

    // ---------- DATE ----------

    if (/\b(date|today|day)\b/.test(t)) {

        return "Today is " +
            new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }) +
            ", Boss.";
    }

    // ---------- OPEN YOUTUBE ----------

    if (/^(open\s+)?youtube$/i.test(t)) {

        window.open(
            "https://www.youtube.com",
            "_blank"
        );

        return "Opening YouTube, Boss.";
    }

    // ---------- OPEN GOOGLE ----------

    if (/^(open\s+)?google$/i.test(t)) {

        window.open(
            "https://www.google.com",
            "_blank"
        );

        return "Opening Google, Boss.";
    }

    // ---------- GOOGLE SEARCH ----------

    const googleMatch = t.match(
        /^(?:google\s+search|search\s+google|search)\s+(?:for\s+)?(.+)/i
    );

    if (googleMatch) {

        const query = googleMatch[1];

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching Google for " +
            query +
            ", Boss.";
    }

    // ---------- YOUTUBE SEARCH ----------

    const playMatch = text.match(
        /^\s*play\s+(.+)/i
    );

    if (playMatch) {

        const query = playMatch[1].trim();

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching YouTube for " +
            query +
            ", Boss.";
    }

    // ---------- WEATHER ----------

    if (/\b(weather|temperature)\b/.test(t)) {

        return new Promise(resolve => {

            if (!navigator.geolocation) {
                resolve("Location is not supported, Boss.");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async position => {

                    try {

                        const lat =
                            position.coords.latitude;

                        const lon =
                            position.coords.longitude;

                        const url =
                            "https://api.open-meteo.com/v1/forecast?latitude=" +
                            lat +
                            "&longitude=" +
                            lon +
                            "&current_weather=true";

                        const response =
                            await fetchWithTimeout(url);

                        if (!response.ok) {
                            throw new Error("Weather failed.");
                        }

                        const data = await response.json();

                        resolve(
                            "Current temperature is " +
                            data.current_weather.temperature +
                            " degrees Celsius, Boss."
                        );

                    } catch (error) {

                        resolve(
                            "Weather service is unavailable, Boss."
                        );
                    }
                },

                () => resolve(
                    "Please allow location permission for weather, Boss."
                )
            );
        });
    }

    // ---------- TIMER ----------

    const timerMatch = t.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i
    );

    if (t.includes("timer") && timerMatch) {

        const amount = parseInt(
            timerMatch[1],
            10
        );

        const unit = timerMatch[2].toLowerCase();

        let factor = 1000;

        if (/^(minutes?|mins?)$/.test(unit)) {
            factor = 60000;
        }

        if (/^(hours?|hrs?)$/.test(unit)) {
            factor = 3600000;
        }

        setTimeout(() => {

            const message =
                "Boss, " +
                amount +
                " " +
                unit +
                " timer finished.";

            add(message, "ai");
            speak(message);

        }, amount * factor);

        return "Timer set for " +
            amount +
            " " +
            unit +
            ", Boss.";
    }

    // ---------- TRANSLATE TO TELUGU ----------

    if (t.includes("translate")) {

        const q = text.replace(
            /^translate(?:\s+this)?\s*/i,
            ""
        ).trim();

        if (!q) {
            return "Tell me what to translate, Boss.";
        }

        try {

            const url =
                "https://api.mymemory.translated.net/get?q=" +
                encodeURIComponent(q) +
                "&langpair=en|te";

            const response =
                await fetchWithTimeout(url);

            if (!response.ok) {
                throw new Error("Translation failed.");
            }

            const data = await response.json();

            return "In Telugu: " +
                data.responseData.translatedText;

        } catch (error) {

            return "Translation service error, Boss.";
        }
    }

    // ---------- NEWS ----------

    if (t.includes("news")) {

        window.open(
            "https://news.google.com",
            "_blank"
        );

        return "Opening Google News, Boss.";
    }

    // ---------- CALCULATOR ----------

    if (t.includes("calculator")) {

        window.open(
            "https://www.google.com/search?q=calculator",
            "_blank"
        );

        return "Opening calculator, Boss.";
    }

    // ---------- HELP ----------

    if (t === "help" || t.includes("commands")) {

        return "I can help with time, date, weather, timers, translation, YouTube, Google searches, news, calculator and general AI conversation, Boss.";
    }

    return null;
}

// ==================== 13. COMMAND PROCESSOR ====================

let isProcessing = false;

async function processCommand() {

    // Prevent multiple simultaneous requests.
    if (isProcessing) {
        return;
    }

    const text = input.value.trim();

    if (!text) {
        return;
    }

    isProcessing = true;

    sendBtn.disabled = true;

    input.value = "";

    add(text, "user");

    remember(text, "user");

    setStatus("PROCESSING COMMAND...");

    try {

        // Check tools first.
        const toolResult = await handleTools(text);

        if (toolResult !== null) {

            add(toolResult, "ai");

            remember(toolResult, "model");

            speak(toolResult);

            resetStatus();

            return;
        }

        // AI chat with retry and fallback.
        const answer = await callGeminiRaw(text);

        add(answer, "ai");

        remember(answer, "model");

        speak(answer);

        resetStatus();

    } catch (error) {

        console.error("JARVIS ERROR:", error);

        let message = error.message || "Unknown error";

        if (
            message.includes("503") ||
            message.toLowerCase().includes("overloaded")
        ) {

            message =
                "All available AI servers are busy right now. Please try again in a few seconds.";
        }

        add(
            "ERROR: " + message,
            "ai"
        );

        setStatus("CONNECTION ERROR");

    } finally {

        isProcessing = false;

        sendBtn.disabled = false;

        input.focus();
    }
}

// ==================== 14. SEND BUTTON ====================

sendBtn.addEventListener(
    "click",
    processCommand
);

// ==================== 15. ENTER KEY ====================

input.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {
            event.preventDefault();
            processCommand();
        }
    }
);

// ==================== 16. CLEAR MEMORY ====================

clearBtn.addEventListener(
    "click",
    function() {

        MEMORY = [];

        saveMemory();

        chat.innerHTML = "";

        speechSynthesis.cancel();

        add(
            "Memory and chat history cleared, Boss.",
            "ai"
        );

        resetStatus();
    }
);

// ==================== 17. MICROPHONE ====================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SpeechRecognition) {

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";

    recognition.continuous = false;

    recognition.interimResults = false;

    micBtn.addEventListener(
        "click",
        function() {

            try {

                recognition.start();

                setStatus("LISTENING...");

            } catch (error) {

                add(
                    "Microphone is already active.",
                    "ai"
                );
            }
        }
    );

    recognition.onresult = function(event) {

        const transcript =
            event.results[0][0].transcript;

        input.value = transcript;

        resetStatus();

        processCommand();
    };

    recognition.onerror = function(event) {

        add(
            "Voice error: " +
            event.error,
            "ai"
        );

        resetStatus();
    };

    recognition.onend = function() {
        resetStatus();
    };

} else {

    micBtn.addEventListener(
        "click",
        function() {

            add(
                "Voice recognition is not supported in this browser. Try Chrome.",
                "ai"
            );
        }
    );
}

// ==================== 18. CAMERA / IMAGE BUTTON ====================

camBtn.addEventListener(
    "click",
    function() {
        imgInput.click();
    }
);

// ==================== 19. IMAGE ANALYSIS ====================

imgInput.addEventListener(
    "change",
    async function() {

        const file = imgInput.files[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {

            add(
                "Please select a valid image.",
                "ai"
            );

            return;
        }

        if (file.size > 4 * 1024 * 1024) {

            add(
                "Please choose an image smaller than 4 MB.",
                "ai"
            );

            imgInput.value = "";

            return;
        }

        isProcessing = true;

        sendBtn.disabled = true;

        setStatus("ANALYZING IMAGE...");

        add(
            "Image selected: " +
            file.name,
            "user"
        );

        try {

            const base64 = await new Promise(
                (resolve, reject) => {

                    const reader = new FileReader();

                    reader.onload = function() {

                        const result = reader.result;

                        resolve(
                            result.split(",")[1]
                        );
                    };

                    reader.onerror = reject;

                    reader.readAsDataURL(file);
                }
            );

            const prompt =
                "Analyze this image carefully and explain what you see.";

            const answer =
                await callGeminiRaw(
                    prompt,
                    base64,
                    file.type
                );

            add(answer, "ai");

            remember(
                "User uploaded an image for analysis.",
                "user"
            );

            remember(answer, "model");

            speak(answer);

            resetStatus();

        } catch (error) {

            console.error(
                "Image error:",
                error
            );

            add(
                "Image analysis failed: " +
                error.message,
                "ai"
            );

            setStatus("IMAGE ERROR");

        } finally {

            isProcessing = false;

            sendBtn.disabled = false;

            imgInput.value = "";
        }
    }
);

// ==================== 20. READY ====================

console.log("J.A.R.V.I.S. loaded successfully.");

resetStatus();
      
