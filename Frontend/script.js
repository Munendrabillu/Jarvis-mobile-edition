/* =====================================================
   J.A.R.V.I.S. PERSONAL AI ASSISTANT
   GEMINI + MEMORY + VOICE + CAMERA + 15 TOOLS
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
    const savedMemory = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );

    if (Array.isArray(savedMemory)) {
        MEMORY = savedMemory.filter(
            m => m &&
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

// Restore memory

MEMORY.forEach(m => {
    add(
        (m.role === "user" ? "YOU: " : "J.A.R.V.I.S: ") +
        m.text,
        m.role === "user" ? "user" : "ai"
    );
});

// ===== 5. TOOL FETCH SYSTEM =====

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
            throw new Error("HTTP " + response.status);
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
                            "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m";

                        const data =
                            await fetchToolJson(url);

                        const current =
                            data.current;

                        resolve(
                            "Current temperature is " +
                            current.temperature_2m +
                            " degrees Celsius. Humidity is " +
                            current.relative_humidity_2m +
                            " percent. Wind speed is " +
                            current.wind_speed_10m +
                            " km/h, Boss."
                        );

                    } catch (e) {

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
            /^(hours?|hrs?)$/.test(unit)
                ? 3600000
                : /^(seconds?|secs?)$/.test(unit)
                    ? 1000
                    : 60000;

        const duration = amount * factor;

        setTimeout(() => {

            speak(
                "Timer finished! " +
                amount + " " + unit + " completed, Boss."
            );

            add(
                "SYSTEM: Timer finished!",
                "ai"
            );

        }, duration);

        return "Timer set for " +
            amount + " " + unit + ", Boss.";
    }

    // ----- 4. DICE / COIN -----

    if (
        t.includes("roll dice") ||
        t.includes("roll a dice") ||
        t.includes("dice roll") ||
        t.includes("roll die")
    ) {

        const result =
            Math.floor(Math.random() * 6) + 1;

        return "You rolled " + result + ", Boss.";
    }

    if (
        t.includes("coin toss") ||
        t.includes("toss coin") ||
        t.includes("flip coin") ||
        t.includes("flip a coin")
    ) {

        const result =
            Math.random() < 0.5
                ? "Heads"
                : "Tails";

        return "The coin landed on " + result + ", Boss.";
    }

    // ----- 5. JOKE -----

    if (
        t.includes("joke") ||
        t.includes("tell me a joke")
    ) {

        const jokes = [
            "Why did the computer go to the doctor? Because it had a virus!",
            "Why do programmers prefer dark mode? Because light attracts bugs!",
            "What is a computer's favorite snack? Microchips!",
            "Why did the developer go broke? Because he used up all his cache!",
            "Why was the computer cold? It left its Windows open!",
            "Why did the robot go on vacation? It needed to recharge!",
            "What do computers eat? Bytes!",
            "Why did the programmer quit his job? He didn't get arrays!"
        ];

        return jokes[
            Math.floor(Math.random() * jokes.length)
        ] + " Boss.";
    }

    // ----- 6. MOTIVATIONAL QUOTE -----

    if (
        t.includes("quote") ||
        t.includes("motivation") ||
        t.includes("motivational")
    ) {

        const quotes = [
            "Great things are done by a series of small things brought together.",
            "Believe you can and you are halfway there.",
            "Success is the sum of small efforts repeated day after day.",
            "Your future depends on what you do today.",
            "Dream big, work hard, stay focused.",
            "Never give up. Great things take time.",
            "Discipline is the bridge between goals and accomplishment.",
            "Every expert was once a beginner."
        ];

        return quotes[
            Math.floor(Math.random() * quotes.length)
        ];
    }

    // ----- 7. NEWS -----

    if (
        t.includes("news") ||
        t.includes("headlines")
    ) {

        const query = text
            .replace(/latest news/i, "")
            .replace(/news/i, "")
            .replace(/headlines/i, "")
            .trim();

        const searchQuery = query || "latest news";

        window.open(
            "https://news.google.com/search?q=" +
            encodeURIComponent(searchQuery),
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening news for " +
            searchQuery + ", Boss.";
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

            const data =
                await fetchToolJson(url);

            const translated =
                data?.responseData?.translatedText;

            if (!translated) {
                return "Translation unavailable, Boss.";
            }

            return "In Telugu: " + translated;

        } catch (e) {

            return "Translate error, Boss.";
        }
    }

    // ----- 9. CURRENCY CONVERTER -----

    const currencyMatch = t.match(
        /(\d+(?:\.\d+)?)\s*([a-z]{3})\s*(?:to|into|in)\s*([a-z]{3})/i
    );

    if (
        t.includes("convert") ||
        currencyMatch
    ) {

        if (!currencyMatch) {
            return "Example: Convert 100 USD to INR, Boss.";
        }

        const amount = Number(currencyMatch[1]);
        const from = currencyMatch[2].toUpperCase();
        const to = currencyMatch[3].toUpperCase();

        try {

            const url =
                "https://api.frankfurter.app/latest?amount=" +
                amount +
                "&from=" + encodeURIComponent(from) +
                "&to=" + encodeURIComponent(to);

            const data =
                await fetchToolJson(url);

            const result = data.rates?.[to];

            if (result === undefined) {
                return "Currency conversion unavailable, Boss.";
            }

            return amount + " " + from +
                " equals " + result + " " + to + ", Boss.";

        } catch (e) {

            return "Currency conversion error, Boss.";
        }
    }

    // ----- 10. WORD MEANING -----

    if (
        t.startsWith("meaning ") ||
        t.startsWith("define ") ||
        t.startsWith("definition of ")
    ) {

        const query = text
            .replace(/^meaning\s+/i, "")
            .replace(/^define\s+/i, "")
            .replace(/^definition of\s+/i, "")
            .trim();

        if (!query) {
            return "Tell me which word you want to know, Boss.";
        }

        try {

            const url =
                "https://en.wiktionary.org/api/rest_v1/page/summary/" +
                encodeURIComponent(query);

            const data =
                await fetchToolJson(url);

            return data.extract
                ? "Meaning of " + query + ": " + data.extract
                : "I could not find the meaning, Boss.";

        } catch (e) {

            return "Meaning lookup error, Boss.";
        }
    }

    // ----- 11. PASSWORD GENERATOR -----

    if (
        t.includes("generate password") ||
        t.includes("strong password") ||
        t.includes("create password")
    ) {

        const lengthMatch = t.match(/\b(\d{1,3})\b/);

        let length = lengthMatch
            ? parseInt(lengthMatch[1], 10)
            : 16;

        length = Math.max(8, Math.min(64, length));

        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            "abcdefghijklmnopqrstuvwxyz" +
            "0123456789!@#$%^&*()_+-=";

        let password = "";

        if (window.crypto && window.crypto.getRandomValues) {

            const values =
                new Uint32Array(length);

            window.crypto.getRandomValues(values);

            for (let i = 0; i < length; i++) {
                password += chars[
                    values[i] % chars.length
                ];
            }

        } else {

            for (let i = 0; i < length; i++) {
                password += chars[
                    Math.floor(Math.random() * chars.length)
                ];
            }
        }

        return "Your generated password is: " +
            password + ", Boss.";
    }

    // ----- 12. GOOGLE / WEB SEARCH -----

    const searchMatch = text.match(
        /^\s*(?:search|look up)\s+(?:for\s+)?(.+?)\s*$/i
    );

    const googleSearchMatch = text.match(
        /^\s*(?:google\s+search|search\s+on\s+google|google)\s+(?:for\s+)?(.+?)\s*$/i
    );

    if (searchMatch || googleSearchMatch) {

        const query =
            (searchMatch || googleSearchMatch)[1].trim();

        if (!query) {
            return "Tell me what to search for, Boss.";
        }

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank",
            "noopener,noreferrer"
        );

        return "Searching Google for " +
            query + ", Boss.";
    }

    // ----- 13. OPEN APPS / WEBSITES -----

    if (
        /^\s*(?:open\s+)?youtube\s*$/i.test(t) ||
        /^\s*open\s+youtube\s*$/i.test(t)
    ) {

        window.open(
            "https://www.youtube.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening YouTube, Boss.";
    }

    if (
        /^\s*(?:open\s+)?google\s*$/i.test(t) ||
        /^\s*open\s+google\s*$/i.test(t)
    ) {

        window.open(
            "https://www.google.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Google, Boss.";
    }

    if (
        /^\s*open\s+whatsapp\s*$/i.test(t)
    ) {

        window.open(
            "https://web.whatsapp.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening WhatsApp, Boss.";
    }

    if (
        /^\s*open\s+instagram\s*$/i.test(t)
    ) {

        window.open(
            "https://www.instagram.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Instagram, Boss.";
    }

    if (
        /^\s*open\s+facebook\s*$/i.test(t)
    ) {

        window.open(
            "https://www.facebook.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Facebook, Boss.";
    }

    if (
        /^\s*open\s+gmail\s*$/i.test(t)
    ) {

        window.open(
            "https://mail.google.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Gmail, Boss.";
    }

    // ----- 14. PLAY SONGS -----

    if (
        t.startsWith("play ") ||
        t.startsWith("youtube ")
    ) {

        const query = text
            .replace(/^play\s+/i, "")
            .replace(/^youtube\s+(search\s+)?/i, "")
            .trim();

        if (query) {

            window.open(
                "https://www.youtube.com/results?search_query=" +
                encodeURIComponent(query),
                "_blank",
                "noopener,noreferrer"
            );

            return "Searching YouTube for " +
                query + ", Boss.";
        }
    }

    // ----- 15. CRYPTO -----

    if (
        t.includes("bitcoin") ||
        t.includes("crypto") ||
        t.includes("btc price") ||
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

            const data =
                await fetchToolJson(url);

            const price = data?.[coin];

            if (!price) {
                throw new Error("Price unavailable");
            }

            return coin + " price is $" +
                price.usd + " USD and ₹" +
                price.inr + " INR, Boss.";

        } catch (e) {

            window.open(
                "https://www.google.com/search?q=" +
                encodeURIComponent(coin + " price"),
                "_blank",
                "noopener,noreferrer"
            );

            return "Opening current " +
                coin + " price search, Boss.";
        }
    }

    // ----- OPEN URL -----

    const urlCommand = text.match(
        /^\s*(?:open|visit|go to)\s+(https?:\/\/\S+)\s*$/i
    );

    if (urlCommand) {

        try {

            const destination =
                new URL(urlCommand[1]);

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

        } catch (e) {

            return "That link does not look valid.";
        }
    }

    // No tool matched

    return null;
}

// ===== 7. GEMINI AI ENGINE =====

async function callGemini(promptText) {

    if (!API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    const contents = MEMORY
        .slice(-12)
        .map(m => ({
            role: m.role === "user" ? "user" : "model",
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

    throw lastError ||
        new Error("All AI models failed.");
}

// ===== 8. ASK JARVIS (TOOLS + GEMINI) =====

async function askGemini(promptText) {

    const loading = add(
        "J.A.R.V.I.S: Thinking...",
        "ai"
    );

    if (!loading) return;

    try {

        // Check tools first

        const toolReply =
            await handleTools(promptText);

        // If a tool handled it

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

        // Otherwise call Gemini

        const reply =
            await callGemini(promptText);

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

// ===== 9. IMAGE UPLOAD / CAMERA =====

if (camBtn && imgInput) {

    camBtn.onclick = () => {
        imgInput.click();
    };

    imgInput.onchange = () => {

        const file = imgInput.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            add(
                "SYSTEM: Please select an image.",
                "ai"
            );

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
                input?.value.trim() ||
                "Describe what you see in this image.";

            add(
                "YOU: [IMAGE] " + question,
                "user"
            );

            if (input) {
                input.value = "";
            }

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

// ===== 10. IMAGE ANALYSIS ENGINE =====

async function askVision(base64, mimeType, question) {

    const loading = add(
        "J.A.R.V.I.S: Analyzing image...",
        "ai"
    );

    if (!loading) return;

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
                throw new Error("No image analysis response.");
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

            if (imgInput) {
                imgInput.value = "";
            }

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

    if (imgInput) {
        imgInput.value = "";
    }
}

// ===== 11. VOICE RECOGNITION =====

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

        add(
            "YOU: " + text,
            "user"
        );

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

            micBtn.innerText =
                "LISTENING...";

        } catch (error) {

            console.warn(
                "Voice recognition error:",
                error
            );
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

// ===== 12. TEXT TO SPEECH =====

let voices = [];

function loadVoices() {

    voices = window.speechSynthesis
        ? window.speechSynthesis.getVoices()
        : [];
}

if ("speechSynthesis" in window) {

    loadVoices();

    speechSynthesis.onvoiceschanged =
        loadVoices;
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
        v => v.lang &&
        v.lang.startsWith("en")
    );

    if (voice) {
        utterance.voice = voice;
    }

    speechSynthesis.speak(utterance);
}

// ===== 13. SEND BUTTON =====

if (sendBtn && input) {

    sendBtn.onclick = () => {

        const text =
            input.value.trim();

        if (!text) return;

        add(
            "YOU: " + text,
            "user"
        );

        input.value = "";

        askGemini(text);
    };
}

// ===== 14. ENTER KEY =====

if (input) {

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendBtn?.click();
            }
        }
    );
}

// ===== 15. CLEAR MEMORY =====

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

// ===== 16. SYSTEM READY =====

console.log(
    "J.A.R.V.I.S. system initialized."
);
