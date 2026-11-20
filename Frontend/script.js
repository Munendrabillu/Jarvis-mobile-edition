// ======================================================
// 1. J.A.R.V.I.S. API KEY AND MODELS
// ======================================================

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

// Model fallback list
const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash"
];


// ======================================================
// 2. MEMORY SYSTEM
// ======================================================

let MEMORY = [];

try {
    const storedMemory = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );

    if (Array.isArray(storedMemory)) {
        MEMORY = storedMemory.filter(
            m =>
                m &&
                (m.role === "user" || m.role === "model") &&
                typeof m.text === "string"
        );
    }
} catch (error) {
    MEMORY = [];
    localStorage.removeItem("jarvis_memory");
}

function saveMemory() {
    localStorage.setItem(
        "jarvis_memory",
        JSON.stringify(MEMORY)
    );
}

function remember(text, role) {
    MEMORY.push({
        role: role === "user" ? "user" : "model",
        text: String(text)
    });

    // Keep the last 100 messages
    if (MEMORY.length > 100) {
        MEMORY = MEMORY.slice(-100);
    }

    saveMemory();
}


// ======================================================
// 3. CONNECT HTML ELEMENTS
// ======================================================

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const micBtn = document.getElementById("mic-btn");
const clearBtn = document.getElementById("clear-btn");
const sendBtn = document.getElementById("send");
const camBtn = document.getElementById("cam-btn");
const imgInput = document.getElementById("img-input");
const coreText = document.getElementById("core-text");


// ======================================================
// 4. DISPLAY MESSAGES
// ======================================================

function add(text, role = "ai") {
    const div = document.createElement("div");

    div.className =
        "message " +
        (role === "user"
            ? "user-message"
            : "jarvis-message");

    div.textContent =
        (role === "user"
            ? "YOU: "
            : "J.A.R.V.I.S: ") + text;

    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}


// ======================================================
// 5. RESTORE SAVED CHAT
// ======================================================

MEMORY.forEach(m => {
    add(
        m.text,
        m.role === "user" ? "user" : "ai"
    );
});


// ======================================================
// 6. TEXT TO SPEECH
// ======================================================

function speak(text) {
    if (!("speechSynthesis" in window)) {
        return;
    }

    speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";
    speech.rate = 1;
    speech.pitch = 0.85;

    speechSynthesis.speak(speech);
}


// ======================================================
// 7. FETCH WITH TIMEOUT
// ======================================================

async function fetchToolJson(
    url,
    options = {},
    timeoutMs = 15000
) {
    const controller = new AbortController();

    const timeoutId = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(
                "HTTP Error: " + response.status
            );
        }

        return await response.json();

    } finally {
        clearTimeout(timeoutId);
    }
}


// ======================================================
// 8. DIRECT COMMAND TOOLS
// ======================================================

async function handleTools(text) {
    const t = text.toLowerCase().trim();

    // TIME
    if (/\b(time|clock)\b/.test(t)) {
        return "The current time is " +
            new Date().toLocaleTimeString("en-IN") +
            ", Boss.";
    }

    // DATE
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

    // OPEN YOUTUBE
    if (/^(please\s+)?(open\s+)?youtube$/i.test(t)) {
        window.open(
            "https://www.youtube.com/",
            "_blank"
        );

        return "Opening YouTube, Boss.";
    }

    // OPEN GOOGLE
    if (/^(please\s+)?(open\s+)?google$/i.test(t)) {
        window.open(
            "https://www.google.com/",
            "_blank"
        );

        return "Opening Google, Boss.";
    }

    // OPEN URL
    const urlMatch = text.match(
        /^(?:open|visit|go to)\s+(https?:\/\/\S+)$/i
    );

    if (urlMatch) {
        try {
            const destination = new URL(urlMatch[1]);

            if (
                destination.protocol !== "https:" &&
                destination.protocol !== "http:"
            ) {
                return "Invalid link.";
            }

            window.open(
                destination.href,
                "_blank"
            );

            return "Opening " +
                destination.hostname +
                ", Boss.";

        } catch (error) {
            return "That link is invalid.";
        }
    }

    // GOOGLE SEARCH
    const googleMatch = text.match(
        /^(?:google search|search (?:on )?google(?: for)?)\s+(.+)$/i
    );

    if (googleMatch) {
        const query = googleMatch[1].trim();

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching Google for " +
            query +
            ", Boss.";
    }

    // YOUTUBE SEARCH
    const youtubeMatch = text.match(
        /^(?:play|youtube(?: search)?(?: for)?)\s+(.+)$/i
    );

    if (youtubeMatch) {
        const query = youtubeMatch[1].trim();

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching YouTube for " +
            query +
            ", Boss.";
    }

    // WIKIPEDIA SEARCH
    const wikiMatch = text.match(
        /^(?:search|look up)(?: for)?\s+(.+)$/i
    );

    if (wikiMatch) {
        const query = wikiMatch[1].trim();

        try {
            const url =
                "https://en.wikipedia.org/w/api.php?" +
                "action=query&list=search&srsearch=" +
                encodeURIComponent(query) +
                "&srlimit=1&format=json&origin=*";

            const data = await fetchToolJson(url);

            const result = data?.query?.search?.[0];

            if (!result) {
                return "I couldn't find that, Boss.";
            }

            const snippet = result.snippet
                .replace(/<[^>]*>/g, "")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, "&");

            return "Wikipedia: " +
                result.title +
                ". " +
                snippet;

        } catch (error) {
            return "Wikipedia search failed.";
        }
    }

    // WEATHER
    if (/\b(weather|temperature)\b/.test(t)) {
        return new Promise(resolve => {
            if (!navigator.geolocation) {
                resolve("Location is unavailable.");
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
                            "https://api.open-meteo.com/v1/forecast?" +
                            "latitude=" + lat +
                            "&longitude=" + lon +
                            "&current_weather=true";

                        const data =
                            await fetchToolJson(url);

                        resolve(
                            "Current temperature is " +
                            data.current_weather.temperature +
                            " degrees Celsius, Boss."
                        );

                    } catch (error) {
                        resolve("Weather service error.");
                    }
                },

                () => {
                    resolve(
                        "Please allow location permission."
                    );
                }
            );
        });
    }

    // TIMER
    const timerMatch = t.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/
    );

    if (t.includes("timer") && timerMatch) {
        const amount = parseInt(
            timerMatch[1],
            10
        );

        const unit = timerMatch[2];

        let factor = 1000;

        if (/^(minutes?|mins?)$/.test(unit)) {
            factor = 60000;
        }

        if (/^(hours?|hrs?)$/.test(unit)) {
            factor = 3600000;
        }

        setTimeout(() => {
            const message =
                "Boss, your " +
                amount +
                " " +
                unit +
                " timer is finished.";

            add(message, "ai");
            speak(message);

            remember(message, "model");
        }, amount * factor);

        return "Timer set for " +
            amount +
            " " +
            unit +
            ", Boss.";
    }

    // TRANSLATE TO TELUGU
    if (t.startsWith("translate")) {
        const q = text.replace(
            /^translate(?:\s+this)?\s*/i,
            ""
        ).trim();

        if (!q) {
            return "Tell me what to translate.";
        }

        try {
            const url =
                "https://api.mymemory.translated.net/get?q=" +
                encodeURIComponent(q) +
                "&langpair=en|te";

            const data = await fetchToolJson(url);

            return "In Telugu: " +
                data.responseData.translatedText;

        } catch (error) {
            return "Translation error.";
        }
    }

    // CRYPTO
    if (
        t.includes("bitcoin") ||
        t.includes("crypto") ||
        t.includes("btc")
    ) {
        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(text + " crypto price"),
            "_blank"
        );

        return "Opening crypto information, Boss.";
    }

    // NEWS
    if (t.includes("news")) {
        window.open(
            "https://news.google.com/search?q=" +
            encodeURIComponent(text),
            "_blank"
        );

        return "Opening news search, Boss.";
    }

    // CALCULATOR
    if (t.includes("calculator")) {
        window.open(
            "https://www.google.com/search?q=calculator",
            "_blank"
        );

        return "Opening calculator, Boss.";
    }

    // HELP
    if (
        t === "help" ||
        t.includes("available commands")
    ) {
        return "Commands: time, date, weather, timer, " +
            "translate, play, YouTube, Google search, " +
            "Wikipedia search, news, crypto and calculator.";
    }

    // NO MATCH
    return null;
}


// ======================================================
// 9. GEMINI AI ENGINE
// ======================================================

async function callGeminiRaw(prompt, image = null) {
    if (!API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    // Send recent conversation context
    const contents = MEMORY.slice(-30).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    // Current prompt
    const parts = [{ text: String(prompt) }];

    // Attach image if supplied
    if (image) {
        parts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.data
            }
        });
    }

    contents.push({
        role: "user",
        parts: parts
    });

    // Try available models
    for (const model of MODELS) {
        try {
            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent";

            const response = await fetchToolJson(
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
                            maxOutputTokens: 1500
                        }
                    })
                },
                30000
            );

            const answer =
                response?.candidates?.[0]?.content?.parts
                    ?.map(part => part.text || "")
                    .join("")
                    .trim();

            if (answer) {
                return answer;
            }

        } catch (error) {
            console.error(
                "Model failed:",
                model,
                error
            );
        }
    }

    throw new Error(
        "All Gemini models failed. Check API key or model access."
    );
}


// ======================================================
// 10. CHAT WITH GEMINI
// ======================================================

async function callGemini(prompt) {
    const answer = await callGeminiRaw(prompt);

    return answer;
}


// ======================================================
// 11. MAIN COMMAND PROCESSOR
// ======================================================

async function processCommand() {
    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    add(text, "user");
    remember(text, "user");

    if (coreText) {
        coreText.textContent = "PROCESSING...";
    }

    sendBtn.disabled = true;

    try {
        // Check direct tools
        const toolResult = await handleTools(text);

        if (toolResult !== null) {
            add(toolResult, "ai");
            remember(toolResult, "model");
            speak(toolResult);

            return;
        }

        // Ask Gemini
        const answer = await callGeminiRaw(
            "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
            "Address the user as Boss occasionally. " +
            "Use previous conversation to remember personal facts " +
            "such as favourite colours, names and preferences. " +
            "Answer clearly. User message: " + text
        );

        add(answer, "ai");
        remember(answer, "model");
        speak(answer);

    } catch (error) {
        console.error("JARVIS ERROR:", error);

        add(
            "Error: " + error.message,
            "ai"
        );

    } finally {
        sendBtn.disabled = false;

        if (coreText) {
            coreText.textContent = "SYSTEM READY";
        }
    }
}


// ======================================================
// 12. SEND BUTTON
// ======================================================

sendBtn.addEventListener(
    "click",
    processCommand
);


// ======================================================
// 13. ENTER KEY
// ======================================================

input.addEventListener(
    "keydown",
    function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            processCommand();
        }
    }
);


// ======================================================
// 14. CLEAR MEMORY BUTTON
// ======================================================

clearBtn.addEventListener(
    "click",
    function() {
        const confirmed = confirm(
            "Delete all saved J.A.R.V.I.S. chat memory?"
        );

        if (!confirmed) return;

        MEMORY = [];

        localStorage.removeItem("jarvis_memory");

        chat.innerHTML = "";

        add("Memory cleared, Boss.", "ai");

        if ("speechSynthesis" in window) {
            speechSynthesis.cancel();
        }
    }
);


// ======================================================
// 15. VOICE RECOGNITION
// ======================================================

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
        if (coreText) {
            coreText.textContent = "LISTENING...";
        }

        micBtn.textContent = "🔴";
    };

    recognition.onresult = function(event) {
        const voiceText =
            event.results[0][0].transcript;

        input.value = voiceText;

        processCommand();
    };

    recognition.onerror = function(event) {
        console.error(
            "Voice recognition error:",
            event.error
        );

        add(
            "Voice error: " + event.error,
            "ai"
        );
    };

    recognition.onend = function() {
        micBtn.textContent = "🎙️";

        if (coreText) {
            coreText.textContent = "SYSTEM READY";
        }
    };

    micBtn.addEventListener(
        "click",
        function() {
            try {
                recognition.start();
            } catch (error) {
                console.log(error);
            }
        }
    );

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


// ======================================================
// 16. IMAGE ANALYSIS
// ======================================================

camBtn.addEventListener(
    "click",
    function() {
        imgInput.click();
    }
);

imgInput.addEventListener(
    "change",
    async function() {
        const file = imgInput.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            add("Please select an image.", "ai");
            return;
        }

        add(
            "Image selected: " + file.name,
            "user"
        );

        if (coreText) {
            coreText.textContent = "ANALYZING IMAGE...";
        }

        sendBtn.disabled = true;

        try {
            const data = await new Promise(
                (resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = function() {
                        resolve(reader.result);
                    };

                    reader.onerror = reject;

                    reader.readAsDataURL(file);
                }
            );

            const base64 = data.split(",")[1];

            const prompt =
                "Analyze this image and describe what you see clearly.";

            const answer = await callGeminiRaw(
                prompt,
                {
                    mimeType: file.type,
                    data: base64
                }
            );

            add(answer, "ai");
            remember(
        
