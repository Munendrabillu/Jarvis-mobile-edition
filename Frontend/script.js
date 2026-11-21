/* =====================================================
   J.A.R.V.I.S. PERSONAL AI ASSISTANT
   GEMINI + MEMORY + VOICE + CAMERA + 15 TOOLS + AGENT
===================================================== */

// ===== 1. API KEY & MODELS =====

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    }
}

const MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite"
];

// ===== 2. MEMORY SYSTEM =====

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
} catch (e) {
    MEMORY = [];
}

function saveMemory() {
    localStorage.setItem(
        "jarvis_memory",
        JSON.stringify(MEMORY)
    );
}

// ===== 3. HTML ELEMENTS =====

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const clearBtn = document.getElementById("clear-btn");
const camBtn = document.getElementById("cam-btn");
const imgInput = document.getElementById("img-input");

// ===== 4. CHAT DISPLAY =====

function add(text, type) {
    if (!chat) return null;

    const div = document.createElement("div");

    div.className = "msg " + type;
    div.innerText = text;

    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;

    return div;
}

// Restore saved messages

MEMORY.forEach(m => {
    add(
        (m.role === "user" ? "YOU: " : "J.A.R.V.I.S: ") +
        m.text,
        m.role === "user" ? "user" : "ai"
    );
});

// ===== 5. API FETCH HELPER =====

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

// ===== 6. TOOLS (THE HANDS) — 15 TOOLS =====

async function handleTools(text) {

    const t = text.toLowerCase().trim();

    // ----- 1. TIME -----

    if (
        /\btime\b/.test(t) ||
        t.includes("టైమ్") ||
        t.includes("సమయం")
    ) {

        return "The time is " +
            new Date().toLocaleTimeString() +
            ", Boss.";
    }

    // ----- 2. WEATHER -----

    if (
        t.includes("weather") ||
        t.includes("వాతావరణం")
    ) {

        return await new Promise(resolve => {

            if (!navigator.geolocation) {
                resolve("Geolocation is not supported, Boss.");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async position => {

                    try {

                        const latitude =
                            position.coords.latitude;

                        const longitude =
                            position.coords.longitude;

                        const url =
                            "https://api.open-meteo.com/v1/forecast" +
                            "?latitude=" + latitude +
                            "&longitude=" + longitude +
                            "&current=temperature_2m,relative_humidity_2m,wind_speed_10m";

                        const data = await fetchToolJson(url);

                        const current = data.current;

                        resolve(
                            "Current weather: " +
                            current.temperature_2m +
                            "°C, humidity " +
                            current.relative_humidity_2m +
                            "%, wind " +
                            current.wind_speed_10m +
                            " km/h, Boss."
                        );

                    } catch (error) {

                        resolve("Weather service error, Boss.");
                    }
                },

                () => {
                    resolve(
                        "I need location permission for weather, Boss."
                    );
                },

                {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    // ----- 3. TIMER -----

    const timerMatch = t.match(
        /\b(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i
    );

    if (
        (t.includes("timer") || t.includes("టైమర్")) &&
        timerMatch
    ) {

        const amount = parseInt(timerMatch[1], 10);
        const unit = timerMatch[2].toLowerCase();

        const factor =
            /^(hours?|hrs?)/.test(unit)
                ? 3600000
                : /^(seconds?|secs?)/.test(unit)
                    ? 1000
                    : 60000;

        const duration = amount * factor;

        setTimeout(() => {

            speak(
                "Timer finished! " +
                amount + " " + unit + " completed, Boss."
            );

            add("SYSTEM: Timer finished!", "ai");

        }, duration);

        return "Timer set for " +
            amount + " " + unit +
            ", Boss.";
    }

    // ----- 4. DICE / COIN -----

    if (
        t.includes("dice") ||
        t.includes("roll") ||
        t.includes("coin") ||
        t.includes("toss")
    ) {

        if (t.includes("coin") || t.includes("toss")) {

            const result =
                Math.random() < 0.5 ? "Heads" : "Tails";

            return "Coin toss result: " + result + ", Boss.";
        }

        const dice = Math.floor(Math.random() * 6) + 1;

        return "Dice result: " + dice + ", Boss.";
    }

    // ----- 5. JOKE -----

    if (
        t.includes("joke") ||
        t.includes("funny") ||
        t.includes("చమత్కారం")
    ) {

        try {

            const data = await fetchToolJson(
                "https://official-joke-api.appspot.com/random_joke"
            );

            return data.setup + " " + data.punchline;

        } catch (error) {

            return "I couldn't get a joke right now, Boss.";
        }
    }

    // ----- 6. QUOTE -----

    if (
        t.includes("quote") ||
        t.includes("motivation") ||
        t.includes("motivational")
    ) {

        try {

            const data = await fetchToolJson(
                "https://api.quotable.io/random"
            );

            return data.content +
                " — " + data.author;

        } catch (error) {

            return "Stay focused, work hard and never give up, Boss.";
        }
    }

    // ----- 7. NEWS -----

    if (
        t.includes("news") ||
        t.includes("headlines") ||
        t.includes("latest news")
    ) {

        try {

            const url =
                "https://api.rss2json.com/v1/api.json" +
                "?rss_url=" +
                encodeURIComponent(
                    "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"
                );

            const data = await fetchToolJson(url);

            const items = (data.items || []).slice(0, 5);

            if (!items.length) {
                return "No news headlines found, Boss.";
            }

            return "Latest headlines:\n" +
                items.map(
                    (item, index) =>
                        (index + 1) + ". " + item.title
                ).join("\n");

        } catch (error) {

            return "News service error, Boss.";
        }
    }

    // ----- 8. TRANSLATE TO TELUGU -----

    if (
        t.startsWith("translate") ||
        t.includes("translate this")
    ) {

        const query = text
            .replace(/^translate\s+(this\s+)?/i, "")
            .trim() || "hello";

        try {

            const url =
                "https://api.mymemory.translated.net/get?q=" +
                encodeURIComponent(query) +
                "&langpair=en|te";

            const data = await fetchToolJson(url);

            if (
                !data.responseData ||
                !data.responseData.translatedText
            ) {
                return "Translation unavailable, Boss.";
            }

            return "In Telugu: " +
                data.responseData.translatedText;

        } catch (error) {

            return "Translate error, Boss.";
        }
    }

    // ----- 9. CURRENCY CONVERTER -----

    if (
        t.includes("currency") ||
        t.includes("convert") ||
        t.includes("exchange rate")
    ) {

        const currencyMatch = t.match(
            /(\d+(?:\.\d+)?)\s*([a-z]{3})\s*(?:to|into)\s*([a-z]{3})/i
        );

        if (!currencyMatch) {
            return "Say for example: convert 100 USD to INR, Boss.";
        }

        const amount = parseFloat(currencyMatch[1]);
        const from = currencyMatch[2].toUpperCase();
        const to = currencyMatch[3].toUpperCase();

        try {

            const url =
                "https://api.frankfurter.app/latest?from=" +
                encodeURIComponent(from) +
                "&to=" + encodeURIComponent(to);

            const data = await fetchToolJson(url);

            const rate = data.rates[to];

            if (!rate) {
                return "Currency not supported, Boss.";
            }

            return amount + " " + from +
                " = " + (amount * rate).toFixed(2) +
                " " + to + ", Boss.";

        } catch (error) {

            return "Currency conversion error, Boss.";
        }
    }

    // ----- 10. WORD MEANING -----

    if (
        t.startsWith("meaning ") ||
        t.startsWith("define ") ||
        t.startsWith("definition ")
    ) {

        const word = text.replace(
            /^(meaning|define|definition)\s+/i,
            ""
        ).trim();

        if (!word) {
            return "Tell me which word you want defined, Boss.";
        }

        try {

            const url =
                "https://api.dictionaryapi.dev/api/v2/entries/en/" +
                encodeURIComponent(word);

            const data = await fetchToolJson(url);

            const meaning =
                data[0]?.meanings?.[0]?.definitions?.[0]?.definition;

            if (!meaning) {
                return "Meaning not found, Boss.";
            }

            return word + ": " + meaning;

        } catch (error) {

            return "Meaning not found, Boss.";
        }
    }

    // ----- 11. PASSWORD GENERATOR -----

    if (
        t.includes("password") ||
        t.includes("generate password")
    ) {

        let lengthMatch = t.match(/\b(\d{2})\b/);

        let length = lengthMatch
            ? parseInt(lengthMatch[1], 10)
            : 16;

        length = Math.max(8, Math.min(64, length));

        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            "abcdefghijklmnopqrstuvwxyz" +
            "0123456789!@#$%^&*()_+-=";

        let password = "";

        for (let i = 0; i < length; i++) {

            password += chars.charAt(
                Math.floor(Math.random() * chars.length)
            );
        }

        return "Generated password (" +
            length + " characters): " + password;
    }

    // ----- 12. GOOGLE SEARCH / WIKIPEDIA SEARCH -----

    const googleSearch = t.match(
        /^(?:google\s+search|search\s+on\s+google|search\s+google|google)\s+(?:for\s+)?(.+)$/i
    );

    if (googleSearch) {

        const query = googleSearch[1].trim();

        if (!query) {
            return "Tell me what to search for, Boss.";
        }

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank",
            "noopener,noreferrer"
        );

        return "Searching Google for " + query + ", Boss.";
    }

    const searchMatch = t.match(
        /^(?:search|look up)\s+(?:for\s+)?(.+)$/i
    );

    if (searchMatch) {

        const query = searchMatch[1].trim();

        if (!query) {
            return "Tell me what to search for, Boss.";
        }

        try {

            const url =
                "https://en.wikipedia.org/w/api.php" +
                "?action=query&list=search&srlimit=1" +
                "&srsearch=" +
                encodeURIComponent(query) +
                "&format=json&origin=*";

            const data = await fetchToolJson(url);

            const result = data.query?.search?.[0];

            if (!result) {

                window.open(
                    "https://www.google.com/search?q=" +
                    encodeURIComponent(query),
                    "_blank",
                    "noopener,noreferrer"
                );

                return "Searching Google for " + query + ", Boss.";
            }

            const snippet = String(result.snippet || "")
                .replace(/<[^>]*>/g, "")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">");

            return "Wikipedia summary: " +
                result.title + ". " + snippet;

        } catch (error) {

            window.open(
                "https://www.google.com/search?q=" +
                encodeURIComponent(query),
                "_blank",
                "noopener,noreferrer"
            );

            return "Searching Google for " + query + ", Boss.";
        }
    }

    // ----- 13. OPEN APPS / WEBSITES -----

    if (
        /^\s*(?:please\s+)?(?:open|launch)\s+youtube\s*$/i.test(text)
    ) {

        window.open(
            "https://youtube.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening YouTube, Boss.";
    }

    if (
        /^\s*(?:please\s+)?(?:open|launch)\s+google\s*$/i.test(text)
    ) {

        window.open(
            "https://google.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Google, Boss.";
    }

    if (
        /^\s*(?:please\s+)?(?:open|launch)\s+facebook\s*$/i.test(text)
    ) {

        window.open(
            "https://facebook.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Facebook, Boss.";
    }

    if (
        /^\s*(?:please\s+)?(?:open|launch)\s+instagram\s*$/i.test(text)
    ) {

        window.open(
            "https://instagram.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Instagram, Boss.";
    }

    if (
        /^\s*(?:please\s+)?(?:open|launch)\s+whatsapp\s*$/i.test(text)
    ) {

        window.open(
            "https://web.whatsapp.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening WhatsApp Web, Boss.";
    }

    // Generic safe URL opening

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
                destination.hostname + ", Boss.";

        } catch (error) {

            return "That link does not look valid.";
        }
    }

    // ----- 14. PLAY SONGS / YOUTUBE -----

    const playMatch = text.match(
        /^\s*play\s+(.+)\s*$/i
    );

    const youtubeMatch = text.match(
        /^\s*youtube(?:\s+search)?(?:\s+for)?\s+(.+)\s*$/i
    );

    const searchYoutubeMatch = text.match(
        /^\s*search\s+(?:on\s+)?youtube(?:\s+for)?\s+(.+)\s*$/i
    );

    const videoQuery =
        (playMatch || youtubeMatch || searchYoutubeMatch)?.[1]?.trim();

    if (videoQuery) {

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(videoQuery),
            "_blank",
            "noopener,noreferrer"
        );

        return "Searching YouTube for " +
            videoQuery + ", Boss.";
    }

    // ----- 15. CRYPTO / BITCOIN -----

    if (
        t.includes("crypto") ||
        t.includes("bitcoin") ||
        t.includes("btc") ||
        t.includes("ethereum") ||
        t.includes("eth price")
    ) {

        let coin = "bitcoin";

        if (
            t.includes("ethereum") ||
            t.includes("eth price")
        ) {
            coin = "ethereum";
        }

        if (
            t.includes("solana") ||
            t.includes("sol price")
        ) {
            coin = "solana";
        }

        if (
            t.includes("dogecoin") ||
            t.includes("doge")
        ) {
            coin = "dogecoin";
        }

        try {

            const url =
                "https://api.coingecko.com/api/v3/simple/price" +
                "?ids=" + encodeURIComponent(coin) +
                "&vs_currencies=usd,inr";

            const data = await fetchToolJson(url);

            const price = data[coin];

            if (!price) {
                return "Crypto price unavailable, Boss.";
            }

            return coin.toUpperCase() +
                " price: $" + price.usd +
                " USD / ₹" + price.inr +
                " INR, Boss.";

        } catch (error) {

            return "Crypto price service error, Boss.";
        }
    }

    // ----- NO TOOL MATCH -----

    return null;
}

// ===== 7. AGENT MODE ENGINE =====

// Agent mode uses these four tools

const AGENT_TOOLS = Object.freeze({

    time: async () => handleTools("current time"),

    weather: async () => handleTools("weather"),

    news: async () => handleTools("news"),

    crypto: async () => handleTools("bitcoin price")

});

const AGENT_TOOL_NAMES = Object.freeze({

    time: "time",
    weather: "weather",
    news: "news",
    crypto: "crypto"

});

// Detect agent mode requests

function isAgentModeRequest(text = "") {

    const value = String(text || "");

    if (
        /\b(?:agent\s*mode|run\s+(?:the\s+)?agent|use\s+(?:the\s+)?agent)\b/i.test(value)
    ) {
        return true;
    }

    if (
        /\b(?:briefing|research|analyze|analysis)\b/i.test(value)
    ) {
        return true;
    }

    return /\bplan\b/i.test(value) &&
        /\b(?:time|weather|news|crypto|bitcoin|btc)\b/i.test(value);
}

// Parse Gemini tool plan

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

    if (!Array.isArray(parsed)) {
        throw new Error("Agent plan must be an array.");
    }

    const allowed = new Set(
        Object.keys(AGENT_TOOLS)
    );

    return [
        ...new Set(
            parsed
                .filter(item => typeof item === "string")
                .map(item => item.trim().toLowerCase())
                .filter(item => allowed.has(item))
        )
    ];
}

// Agent fallback plan

function fallbackAgentToolPlan(goal) {

    const text = String(goal || "").toLowerCase();

    const plan = [];

    if (
        text.includes("time") ||
        text.includes("clock")
    ) {
        plan.push("time");
    }

    if (
        text.includes("weather") ||
        text.includes("temperature")
    ) {
        plan.push("weather");
    }

    if (
        text.includes("news") ||
        text.includes("headline")
    ) {
        plan.push("news");
    }

    if (
        text.includes("crypto") ||
        text.includes("bitcoin") ||
        text.includes("btc")
    ) {
        plan.push("crypto");
    }

    if (plan.length === 0) {
        plan.push("time", "weather", "news", "crypto");
    }

    return [...new Set(plan)];
}

// ===== 8. RAW GEMINI ENGINE FOR AGENT =====

async function callGeminiRaw(promptText) {

    if (!API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    let lastError;

    for (const model of MODELS) {

        try {

            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent?key=" +
                encodeURIComponent(API_KEY);

            const response = await fetch(url, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    contents: [
                        {
                            role: "user",
                            parts: [
                                { text: promptText }
                            ]
                        }
                    ],

                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 512
                    }

                })

            });

            const data = await response.json();

            if (!response.ok) {

                lastError = new Error(
                    data?.error?.message ||
                    "Agent API request failed."
                );

                if (
                    response.status === 429 ||
                    response.status === 503 ||
                    response.status === 404
                ) {
                    continue;
                }

                throw lastError;
            }

            const reply =
                data?.candidates?.[0]?.content?.parts
                    ?.map(part => part.text || "")
                    .join("");

            if (!reply) {
                throw new Error("Agent returned an empty response.");
            }

            return reply;

        } catch (error) {

            lastError = error;

            if (
                error.message &&
                (
                    error.message.includes("API key") ||
                    error.message.includes("PERMISSION_DENIED")
                )
            ) {
                throw error;
            }
        }
    }

    throw lastError || new Error("Agent models failed.");
}

// ===== 9. RUN AGENT =====

async function runAgent(goal) {

    add("J.A.R.V.I.S: Agent mode active.", "ai");

    add("J.A.R.V.I.S: Analyzing your goal...", "ai");

    const planPrompt =
        'Select tools from ["time","weather","news","crypto"]. ' +
        "Return ONLY a JSON array of tool names. " +
        "Choose tools relevant to the user's goal. " +
        "If the goal requests a general daily briefing, choose all four. " +
        "Goal: " + JSON.stringify(String(goal));

    let toolsToRun;

    try {

        toolsToRun = parseAgentToolPlan(
            await callGeminiRaw(planPrompt)
        );

    } catch (error) {

        toolsToRun = fallbackAgentToolPlan(goal);
    }

    if (!toolsToRun.length) {
        toolsToRun = fallbackAgentToolPlan(goal);
    }

    const results = {};

    for (let i = 0; i < toolsToRun.length; i++) {

        const tool = toolsToRun[i];

        add(
            "J.A.R.V.I.S: [" +
            (i + 1) + "/" +
            toolsToRun.length +
            "] Running " +
            AGENT_TOOL_NAMES[tool] +
            "...",
            "ai"
        );

        try {

            results[tool] = await AGENT_TOOLS[tool]();

        } catch (error) {

            results[tool] =
                "Tool error: " + error.message;
        }
    }

    add("J.A.R.V.I.S: Combining results...", "ai");

    const summaryPrompt =
        "You are J.A.R.V.I.S. Summarize the following agent results " +
        "clearly and concisely in Telugu or English according to " +
        "the user's language. Do not invent facts.\n\n" +
        "User goal: " + String(goal) +
        "\n\nResults:\n" + JSON.stringify(results);

    return await callGemini(summaryPrompt);
}

// ===== 10. GEMINI BRAIN =====

async function callGemini(promptText) {

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
        parts: [{ text: promptText }]
    });

    let lastError;

    for (const model of MODELS) {

        try {

            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent?key=" +
                encodeURIComponent(API_KEY);

            const response = await fetch(url, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    contents: contents,

                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }

                })

            });

            const data = await response.json();

            if (!response.ok) {

                lastError = new Error(
                    data?.error?.message ||
                    "API request failed."
                );

                if (
                    response.status === 429 ||
                    response.status === 503 ||
                    response.status === 404
                ) {
                    continue;
                }

                throw lastError;
            }

            const reply =
                data?.candidates?.[0]?.content?.parts
                    ?.map(part => part.text || "")
                    .join("");

            if (!reply) {
                throw new Error("AI returned an empty response.");
            }

            return reply;

        } catch (error) {

            lastError = error;

            if (
                error.message &&
                (
                    error.message.includes("API key") ||
                    error.message.includes("PERMISSION_DENIED")
                )
            ) {
                throw error;
            }
        }
    }

    throw lastError || new Error("All AI models failed.");
}

// ===== 11. ASK JARVIS =====

async function askGemini(promptText) {

    const loading = add(
        "J.A.R.V.I.S: Thinking...",
        "ai"
    );

    try {

        // ----- AGENT MODE -----

        if (isAgentModeRequest(promptText)) {

            const reply = await runAgent(promptText);

            MEMORY.push({
                role: "user",
                text: promptText
            });

            MEMORY.push({
                role: "model",
                text: reply
            });

            MEMORY = MEMORY.slice(-40);

            saveMemory();

            loading.innerText =
                "J.A.R.V.I.S: " + reply;

            speak(reply);

            return;
        }

        // ----- NORMAL TOOLS -----

        const toolReply = await handleTools(promptText);

        if (toolReply !== null) {

            loading.innerText =
                "J.A.R.V.I.S: " + toolReply;

            MEMORY.push({
                role: "user",
                text: promptText
            });

            MEMORY.push({
                role: "model",
                text: toolReply
            });

            MEMORY = MEMORY.slice(-40);

            saveMemory();

            speak(toolReply);

            return;
        }

        // ----- GEMINI AI -----

        const reply = await callGemini(promptText);

        MEMORY.push({
            role: "user",
            text: promptText
        });

        MEMORY.push({
            role: "model",
            text: reply
        });

        MEMORY = MEMORY.slice(-40);

        saveMemory();

        loading.innerText =
            "J.A.R.V.I.S: " + reply;

        speak(reply);

    } catch (error) {

        loading.innerText =
            "J.A.R.V.I.S: ERROR - " +
            error.message;

        console.error("Gemini error:", error);
    }
}

// ===== 12. IMAGE UPLOAD / CAMERA =====

if (camBtn && imgInput) {

    camBtn.onclick = () => {
        imgInput.click();
    };

    imgInput.onchange = () => {

        const file = imgInput.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            add("SYSTEM: Please select an image.", "ai");

            return;
        }

        if (file.size > 10 * 1024 * 1024) {

            add(
                "SYSTEM: Image must be smaller than 10 MB.",
                "ai"
            );

            imgInput.value = "";

            return;
        }

        const reader = new FileReader();

        reader.onload = () => {

            const base64 =
                reader.result.split(",")[1];

            const question =
                input.value.trim() ||
                "Describe what you see in this image.";

            add(
                "YOU: [IMAGE] " + question,
                "user"
            );

            input.value = "";

            askVision(
                base64,
                file.type,
                question
            );
        };

        reader.onerror = () => {

            add(
                "SYSTEM: Could not read image.",
                "ai"
            );
        };

        reader.readAsDataURL(file);
    };
}

// ===== 13. IMAGE ANALYSIS =====

async function askVision(base64, mimeType, question) {

    const loading = add(
        "J.A.R.V.I.S: Analyzing image...",
        "ai"
    );

    if (!API_KEY) {

        loading.innerText =
            "J.A.R.V.I.S: API key is missing.";

        return;
    }

    let lastError;

    for (const model of MODELS) {

        try {

            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent?key=" +
                encodeURIComponent(API_KEY);

            const response = await fetch(url, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    contents: [
                        {
                            role: "user",
                            parts: [

                                { text: question },

                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64
                                    }
                                }

                            ]
                        }
                    ],

                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }

                })

            });

            const data = await response.json();

            if (!response.ok) {

                lastError = new Error(
                    data?.error?.message ||
                    "Image API request failed."
                );

                if (
                    response.status === 429 ||
                    response.status === 503 ||
                    response.status === 404
                ) {
                    continue;
                }

                throw lastError;
            }

            const reply =
                data?.candidates?.[0]?.content?.parts
                    ?.map(part => part.text || "")
                    .join("");

            if (!reply) {

                throw new Error(
                    "No image analysis response."
                );
            }

            loading.innerText =
                "J.A.R.V.I.S: " + reply;

            MEMORY.push({
                role: "user",
                text: "[Image] " + question
            });

            MEMORY.push({
                role: "model",
                text: reply
            });

            MEMORY = MEMORY.slice(-40);

            saveMemory();

            speak(reply);

            imgInput.value = "";

            return;

        } catch (error) {

            lastError = error;

            if (
                error.message &&
                (
                    error.message.includes("API key") ||
                    error.message.includes("PERMISSION_DENIED")
                )
            ) {
                break;
            }
        }
    }

    loading.innerText =
        "J.A.R.V.I.S: ERROR - " +
        (lastError?.message || "Image analysis failed.");

    console.error("Vision error:", lastError);

    imgInput.value = "";
}

// ===== 14. VOICE RECOGNITION =====

const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SR && micBtn) {

    const rec = new SR();

    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = event => {

        const text =
            event.results[0][0].transcript;

        if (input) {
            input.value = text;
        }

        add("YOU: " + text, "user");

        askGemini(text);
    };

    rec.onerror = event => {

        add(
            "SYSTEM: Voice error - " +
            event.error,
            "ai"
        );
    };

    micBtn.onclick = () => {

        try {

            rec.start();

            micBtn.innerText = "LISTENING...";

        } catch (error) {

            console.warn("Voice recognition error:", error);
        }
    };

    rec.onend = () => {

        micBtn.innerText = "🎙️";
    };

} else if (micBtn) {

    micBtn.onclick = () => {

        add(
            "SYSTEM: Voice recognition is not supported in this browser.",
            "ai"
        );
    };
}

// ===== 15. TEXT TO SPEECH =====

let voices = [];

function loadVoices() {

    voices = window.speechSynthesis
        ? window.speechSynthesis.getVoices()
        : [];
}

if ("speechSynthesis" in window) {

    loadVoices();

    speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(text);

    utterance.rate = 1.05;
    utterance.pitch = 0.85;

    const voice = voices.find(
        v => v.lang && v.lang.startsWith("en")
    );

    if (voice) {
        utterance.voice = voice;
    }

    speechSynthesis.speak(utterance);
}

// ===== 16. SEND BUTTON =====

if (sendBtn && input) {

    sendBtn.onclick = () => {

        const text = input.value.trim();

        if (!text) return;

        add("YOU: " + text, "user");

        input.value = "";

        askGemini(text);
    };
}

// ===== 17. ENTER KEY =====

if (input) {

    input.addEventListener("keydown", event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendBtn?.click();
        }
    });
}

// ===== 18. CLEAR MEMORY =====

if (clearBtn) {

    clearBtn.onclick = () => {

        MEMORY = [];

        saveMemory();

        if (chat) {
            chat.innerHTML = "";
        }

        add(
            "SYSTEM: Memory cleared.",
            "ai"
        );
    };
}

// ===== 19. SYSTEM READY =====

console.log(
    "J.A.R.V.I.S. system initialized with 15 tools and agent mode."
);
  
