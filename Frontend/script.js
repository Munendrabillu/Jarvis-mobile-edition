// =====================================================
// 1. API KEY AND MODEL SETTINGS
// =====================================================

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        localStorage.setItem("jarvis_key", API_KEY);
    }
}

const MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest"
];


// =====================================================
// 2. MEMORY SYSTEM
// =====================================================

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
                typeof m.text === "string" &&
                !(
                    m.role === "model" &&
                    /^Your strong password:/i.test(m.text)
                )
        );

        if (MEMORY.length !== storedMemory.length) {
            localStorage.setItem(
                "jarvis_memory",
                JSON.stringify(MEMORY)
            );
        }

    } else {
        localStorage.removeItem("jarvis_memory");
    }

} catch (e) {
    localStorage.removeItem("jarvis_memory");
}


function saveMemory() {
    localStorage.setItem(
        "jarvis_memory",
        JSON.stringify(MEMORY)
    );
}


// =====================================================
// 3. CONNECT HTML ELEMENTS
// =====================================================

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const micBtn = document.getElementById("mic-btn");
const clearBtn = document.getElementById("clear-btn");
const sendBtn = document.getElementById("send");
const camBtn = document.getElementById("cam-btn");
const imgInput = document.getElementById("img-input");


// =====================================================
// 4. DISPLAY CHAT MESSAGES
// =====================================================

function add(text, role = "ai") {

    const div = document.createElement("div");

    div.className =
        "message " +
        (role === "user" ? "user-message" : "jarvis-message");

    div.textContent =
        (role === "user" ? "YOU: " : "J.A.R.V.I.S: ") +
        text;

    chat.appendChild(div);

    chat.scrollTop = chat.scrollHeight;
}


// =====================================================
// 5. RESTORE PREVIOUS CHAT
// =====================================================

MEMORY.forEach(m => {
    add(m.text, m.role === "user" ? "user" : "ai");
});


// =====================================================
// 6. SAVE CHAT
// =====================================================

function remember(text, role) {

    MEMORY.push({
        role: role === "user" ? "user" : "model",
        text: text
    });

    // Keep only the latest 40 messages
    if (MEMORY.length > 40) {
        MEMORY = MEMORY.slice(-40);
    }

    saveMemory();
}


// =====================================================
// 7. TEXT TO SPEECH
// =====================================================

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


// =====================================================
// 8. FETCH WITH TIMEOUT
// =====================================================

async function fetchToolJson(url, options = {}, timeoutMs = 10000) {

    const controller =
        typeof AbortController === "function"
            ? new AbortController()
            : null;

    const timeoutId = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {

        const response = await fetch(url, {
            ...options,
            ...(controller ? { signal: controller.signal } : {})
        });

        if (!response.ok) {
            throw new Error("Request failed: " + response.status);
        }

        return await response.json();

    } finally {

        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}


// =====================================================
// 9. TOOL ENGINE
// =====================================================

async function handleTools(text) {

    const t = text.toLowerCase().trim();


    // ===== TOOL 1: TIME =====

    if (/\b(time|clock)\b/.test(t)) {

        return "The current time is " +
            new Date().toLocaleTimeString("en-IN") +
            ", Boss.";
    }


    // ===== TOOL 2: DATE =====

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


    // ===== TOOL 3: YOUTUBE =====

    if (
        /^\s*(please\s+)?(open\s+)?youtube\s*$/i.test(text) ||
        /^\s*(open\s+)?youtube\s*$/i.test(text)
    ) {

        window.open(
            "https://www.youtube.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening YouTube, Boss.";
    }


    // ===== TOOL 4: GOOGLE =====

    if (/^\s*(please\s+)?(open\s+)?google\s*$/i.test(text)) {

        window.open(
            "https://www.google.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Google, Boss.";
    }


    // ===== TOOL 5: OPEN URL =====

    const urlCommand = text.match(
        /^\s*(?:open|visit|go to)\s+(https?:\/\/\S+)\s*$/i
    );

    if (urlCommand) {

        try {

            const destination = new URL(urlCommand[1]);

            if (
                destination.protocol !== "https:" &&
                destination.protocol !== "http:"
            ) {
                return "Only HTTP and HTTPS links can be opened.";
            }

            window.open(
                destination.href,
                "_blank",
                "noopener,noreferrer"
            );

            return "Opening " +
                destination.hostname +
                ", Boss.";

        } catch (e) {

            return "That link does not look valid.";
        }
    }


    // ===== TOOL 6: GOOGLE SEARCH =====

    const googleSearch = text.match(
        /^\s*(?:google\s+search|search\s+(?:on\s+)?google(?:\s+for)?)\s+(.+?)\s*$/i
    );

    if (googleSearch) {

        const query = googleSearch[1].trim();

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank",
            "noopener,noreferrer"
        );

        return "Searching Google for " + query + ", Boss.";
    }


    // ===== TOOL 7: YOUTUBE SEARCH =====

    const playMatch = text.match(
        /^\s*play\s+(.+?)\s*$/i
    );

    const youtubeMatch = text.match(
        /^\s*youtube(?:\s+search)?(?:\s+for)?\s+(.+?)\s*$/i
    );

    const videoQuery = (
        playMatch ||
        youtubeMatch
    )?.[1]?.trim();

    if (videoQuery) {

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(videoQuery),
            "_blank",
            "noopener,noreferrer"
        );

        return "Searching YouTube for " +
            videoQuery +
            ", Boss.";
    }


    // ===== TOOL 8: WIKIPEDIA SEARCH =====

    const searchMatch = text.match(
        /^\s*(?:search|look up)\s+(?:for\s+)?(.+?)\s*$/i
    );

    if (searchMatch) {

        const query = searchMatch[1].trim();

        try {

            const url =
                "https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&srsearch=" +
                encodeURIComponent(query) +
                "&format=json&origin=*";

            const data = await fetchToolJson(url);

            const result = data?.query?.search?.[0];

            if (!result) {
                return "I could not find that, Boss.";
            }

            const snippet = String(
                result.snippet || ""
            )
                .replace(/<[^>]*>/g, "")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, "&");

            return "Wikipedia summary: " +
                result.title +
                ". " +
                snippet;

        } catch (e) {

            return "Wikipedia search error, Boss.";
        }
    }


    // ===== TOOL 9: WEATHER =====

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

                        const data =
                            await fetchToolJson(url);

                        resolve(
                            "Current temperature is " +
                            data.current_weather.temperature +
                            " degrees Celsius, Boss."
                        );

                    } catch (e) {

                        resolve("Weather service error, Boss.");
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


    // ===== TOOL 10: TIMER =====

    const timerMatch = t.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i
    );

    if (
        t.includes("timer") &&
        timerMatch
    ) {

        const amount =
            parseInt(timerMatch[1], 10);

        const unit =
            timerMatch[2].toLowerCase();

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


    // ===== TOOL 11: TRANSLATE =====

    if (t.includes("translate")) {

        const q = text
            .replace(/^translate(?:\s+this)?\s*/i, "")
            .trim();

        if (!q) {
            return "Tell me what you want to translate, Boss.";
        }

        try {

            const url =
                "https://api.mymemory.translated.net/get?q=" +
                encodeURIComponent(q) +
                "&langpair=en|te";

            const data =
                await fetchToolJson(url);

            return "In Telugu: " +
                data.responseData.translatedText;

        } catch (e) {

            return "Translation error, Boss.";
        }
    }


    // ===== TOOL 12: CRYPTO =====

    if (
        t.includes("bitcoin") ||
        t.includes("crypto") ||
        t.includes("btc")
    ) {

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(text + " crypto price"),
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening crypto information, Boss.";
    }


    // ===== TOOL 13: NEWS =====

    if (t.includes("news")) {

        window.open(
            "https://news.google.com/search?q=" +
            encodeURIComponent(text),
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening news search, Boss.";
    }


    // ===== TOOL 14: CALCULATOR =====

    if (t.includes("calculator")) {

        window.open(
            "https://www.google.com/search?q=calculator",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening calculator, Boss.";
    }


    // ===== TOOL 15: HELP =====

    if (
        t === "help" ||
        t.includes("available commands")
    ) {

        return "Available commands include time, date, weather, timer, translate, play, YouTube, Google search, Wikipedia search, news, crypto and calculator, Boss.";
    }


    // ===== NO TOOL MATCH =====

    return null;
}


// =====================================================
// 10. AGENT MODE ENGINE
// =====================================================

const AGENT_TOOLS = Object.freeze({

    time: async () => handleTools("current time"),

    weather: async () => handleTools("weather"),

    news: async () => handleTools("news"),

    crypto: async () => handleTools("bitcoin")
});


const AGENT_TOOL_NAMES = Object.freeze({
    time: "time",
    weather: "weather",
    news: "news",
    crypto: "crypto"
});


function isAgentModeRequest(text = "") {

    const value = String(text || "");

    if (
        /\b(?:agent(?:\s+mode)?|run\s+(?:the\s+)?agent|use\s+(?:the\s+)?agent)\b/i.test(value)
    ) {
        return true;
    }

    if (
        /\b(?:briefing|research|analy[sz]e|analysis)\b/i.test(value)
    ) {
        return true;
    }

    return (
        /\bplan\b/i.test(value) &&
        /\b(?:time|weather|news|crypto|bitcoin|btc)\b/i.test(value)
    );
}


// =====================================================
// 11. PARSE AGENT PLAN
// =====================================================

function parseAgentToolPlan(responseText) {

    const text = String(responseText || "")
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start < 0 || end < start) {
        throw new Error("Agent plan format incorrect.");
    }

    const parsed = JSON.parse(
        text.slice(start, end + 1)
    );

    const allowed =
        new Set(Object.keys(AGENT_TOOLS));

    return [
        ...new Set(
            parsed
                .filter(item => typeof item === "string")
                .map(item => item.trim().toLowerCase())
                .filter(item => allowed.has(item))
        )
    ];
}


// =====================================================
// 12. FALLBACK AGENT PLAN
// =====================================================

function fallbackAgentToolPlan(goal) {

    const t = String(goal).toLowerCase();

    const tools = [];

    if (t.includes("time")) {
        tools.push("time");
    }

    if (t.includes("weather")) {
        tools.push("weather");
    }

    if (t.includes("news")) {
        tools.push("news");
    }

    if (
        t.includes("crypto") ||
        t.includes("bitcoin") ||
        t.includes("btc")
    ) {
        tools.push("crypto");
    }

    if (tools.length === 0) {
        tools.push("time", "weather", "news");
    }

    return tools;
}


// =====================================================
// 13. RUN AGENT
// =====================================================

async function runAgent(goal) {

    add("Agent mode active.", "ai");

    add("Analyzing your goal...", "ai");

    const planPrompt =
        "Select tools from " +
        JSON.stringify(Object.keys(AGENT_TOOLS)) +
        ". Goal: " +
        JSON.stringify(String(goal)) +
        ". Return only a JSON array of tool names.";

    let toolsToRun;

    try {

        toolsToRun =
            parseAgentToolPlan(
                await callGeminiRaw(planPrompt)
            );

    } catch (error) {

        toolsToRun =
            fallbackAgentToolPlan(goal);
    }

    const results = {};

    for (
        let i = 0;
        i < toolsToRun.length;
        i++
    ) {

        const tool = toolsToRun[i];

        add(
            "Running " +
            tool +
            " tool (" +
            (i + 1) +
            "/" +
            toolsToRun.length +
            ")...",
            "ai"
        );

        try {

            results[tool] =
                await AGENT_TOOLS[tool]();

        } catch (e) {

            results[tool] =
                "Tool error.";
        }
    }

    const summaryPrompt =
        "Goal: " +
        JSON.stringify(String(goal)) +
        "\nTool results: " +
        JSON.stringify(results) +
        "\nSummarize the results clearly and concisely.";

    return await callGemini(summaryPrompt);
}


// =====================================================
// 14. GEMINI BRAIN
// =====================================================

async function callGeminiRaw(prompt) {

    if (!API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    const contents = MEMORY
        .slice(-12)
        .map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

    contents.push({
        role: "user",
        parts: [{ text: prompt }]
    });

    for (const model of MODELS) {

        try {

            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent";

            const response =
                await fetchToolJson(
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
                                maxOutputTokens: 1000
                            }
                        })
                    },
                    20000
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
                "Gemini model failed:",
                model,
                error
            );
        }
    }

    throw new Error("All Gemini models failed.");
}


// =====================================================
// 15. GEMINI CHAT
// =====================================================

async function callGemini(prompt) {

    if (!API_KEY) {
        return "Gemini API key is missing, Boss.";
    }

    try {

        const answer =
            await callGeminiRaw(prompt);

        remember(prompt, "user");
        remember(answer, "model");

        return answer;

    } catch (error) {

        console.error(error);

        return "Gemini connection error, Boss.";
    }
}
// ===== 16. MAIN COMMAND PROCESSOR =====

async function processCommand() {

    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    add(text, "user");

    remember(text, "user");

    try {

        // Direct tools first
        const toolResult = await handleTools(text);

        if (toolResult !== null) {

            add(toolResult, "ai");
            speak(toolResult);
            remember(toolResult, "model");

            return;
        }

        // Gemini AI
        if (!API_KEY) {
            throw new Error("API key is missing");
        }

        const answer = await callGeminiRaw(text);

        add(answer, "ai");
        speak(answer);
        remember(answer, "model");

    } catch (error) {

        console.error("JARVIS ERROR:", error);

        add(
            "Connection error: " +
            error.message,
            "ai"
        );
    }
}
// ===== 16. MAIN COMMAND PROCESSOR =====

async function processCommand() {

    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    add(text, "user");

    remember(text, "user");

    try {

        // Direct tools first
        const toolResult = await handleTools(text);

        if (toolResult !== null) {

            add(toolResult, "ai");
            speak(toolResult);
            remember(toolResult, "model");

            return;
        }

        // Gemini AI
        if (!API_KEY) {
            throw new Error("API key is missing");
        }

        const answer = await callGeminiRaw(text);

        add(answer, "ai");
        speak(answer);
        remember(answer, "model");

    } catch (error) {

        console.error("JARVIS ERROR:", error);

        add(
            "Connection error: " +
            error.message,
            "ai"
        );
    }
}

console.log("JARVIS SCRIPT LOADED");

alert("JARVIS JavaScript is working!");
