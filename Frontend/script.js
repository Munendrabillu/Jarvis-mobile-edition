// =======================================================
// J.A.R.V.I.S. - COMPLETE UPDATED SCRIPT
// Retry + Model Fallback + Voice + Image + Memory + Tools
// =======================================================


// ====================== 1. API KEY ======================

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY && API_KEY.trim()) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    }
}

// Multiple models for automatic fallback
const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite"
];


// ====================== 2. HTML ELEMENTS ======================

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");
const coreText = document.getElementById("core-text");


// ====================== 3. MEMORY ======================

let MEMORY = [];
let FACTS = {};

try {
    MEMORY = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );

    if (!Array.isArray(MEMORY)) MEMORY = [];
} catch (e) {
    MEMORY = [];
}

try {
    FACTS = JSON.parse(
        localStorage.getItem("jarvis_facts") || "{}"
    );

    if (!FACTS || typeof FACTS !== "object" ||
        Array.isArray(FACTS)) {
        FACTS = {};
    }
} catch (e) {
    FACTS = {};
}


function saveMemory() {
    localStorage.setItem(
        "jarvis_memory",
        JSON.stringify(MEMORY.slice(-40))
    );
}


function saveFacts() {
    localStorage.setItem(
        "jarvis_facts",
        JSON.stringify(FACTS)
    );
}


function remember(text, role) {
    MEMORY.push({
        role: role,
        text: text
    });

    MEMORY = MEMORY.slice(-40);

    saveMemory();
}


// ====================== 4. DISPLAY CHAT ======================

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


// ====================== 5. STATUS ======================

function setStatus(text) {

    if (coreText) {
        coreText.textContent = text;
    }
}


function setProcessing(active) {

    setStatus(
        active
            ? "PROCESSING..."
            : "SYSTEM READY"
    );

    sendBtn.disabled = active;

    sendBtn.textContent =
        active ? "WAIT..." : "EXECUTE";

    sendBtn.style.opacity =
        active ? "0.6" : "1";
}


// ====================== 6. SPEECH ======================

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


// ====================== 7. DELAY ======================

function delay(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


// ====================== 8. GEMINI API WITH FALLBACK ======================

async function callGemini(prompt, imageData = null) {

    if (!API_KEY) {
        throw new Error("API key is missing.");
    }

    const history = MEMORY
        .slice(-12)
        .map(m => {
            return (m.role === "user" ? "User: " : "Jarvis: ") +
                m.text;
        })
        .join("\n");

    const savedFacts = Object.entries(FACTS)
        .map(([key, value]) => key + ": " + value)
        .join("\n");

    const systemPrompt =
        "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
        "Answer clearly and naturally. " +
        "Use the user's saved facts when relevant. " +
        "Do not invent saved facts.\n\n" +
        "Saved user facts:\n" +
        (savedFacts || "No saved facts.") +
        "\n\nPrevious conversation:\n" +
        (history || "No previous conversation.") +
        "\n\nCurrent user message:\n" +
        prompt;

    let requestInput;

    if (imageData) {

        requestInput = [
            {
                type: "text",
                text: systemPrompt
            },
            {
                type: "image",
                data: imageData.base64,
                mime_type: imageData.mime
            }
        ];

    } else {

        requestInput = systemPrompt;

    }


    // Try all available models

    let lastError = null;

    for (const model of MODELS) {

        // Two attempts per model
        for (let attempt = 1; attempt <= 2; attempt++) {

            try {

                setStatus(
                    "CONNECTING " +
                    model +
                    "..."
                );

                const response = await fetch(
                    "https://generativelanguage.googleapis.com/v1beta/interactions",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": API_KEY
                        },

                        body: JSON.stringify({
                            model: model,
                            input: requestInput
                        })
                    }
                );


                // Read API response

                const data = await response.json();


                // Handle errors

                if (!response.ok) {

                    const apiMessage =
                        data?.error?.message ||
                        data?.message ||
                        "Unknown API error";

                    const error = new Error(
                        "HTTP " +
                        response.status +
                        ": " +
                        apiMessage
                    );

                    error.status = response.status;

                    throw error;
                }


                // Extract response text

                let answer = "";

                if (data.output_text) {

                    answer = data.output_text;
                }


                // Extract from steps

                if (!answer && Array.isArray(data.steps)) {

                    answer = data.steps
                        .filter(step =>
                            step.type === "model_output"
                        )
                        .flatMap(step =>
                            step.content || []
                        )
                        .filter(part =>
                            part.type === "text"
                        )
                        .map(part =>
                            part.text || ""
                        )
                        .join("\n");
                }


                // Extract from output

                if (!answer && Array.isArray(data.output)) {

                    answer = data.output
                        .filter(part =>
                            part.type === "text"
                        )
                        .map(part =>
                            part.text || ""
                        )
                        .join("\n");
                }


                if (!answer) {

                    throw new Error(
                        "The model returned an empty response."
                    );
                }


                console.log(
                    "JARVIS successful model:",
                    model
                );

                return answer.trim();


            } catch (error) {

                lastError = error;

                console.error(
                    "Model failed:",
                    model,
                    "Attempt:",
                    attempt,
                    error
                );


                // Do not retry invalid API keys

                if (
                    error.status === 400 ||
                    error.status === 401 ||
                    error.status === 403
                ) {

                    throw error;
                }


                // Wait before retrying

                if (attempt < 2) {

                    setStatus(
                        "RETRYING " +
                        model +
                        "..."
                    );

                    await delay(2000);
                }
            }
        }


        // Switch to next model

        setStatus(
            "SWITCHING MODEL..."
        );

        await delay(1000);
    }


    throw new Error(
        "All Gemini models failed. Last error: " +
        (lastError?.message || "Unknown error")
    );
}


// ====================== 9. SAVE PERSONAL FACTS ======================

function normalizeKey(text) {

    return text
        .toLowerCase()
        .trim()
        .replace(/[?!.,]+$/g, "")
        .replace(/\s+/g, " ");
}


function saveUserFact(text) {

    const patterns = [
        /^my\s+(.+?)\s+is\s+(.+)$/i,
        /^my\s+(.+?)\s+are\s+(.+)$/i,
        /^remember\s+(?:that\s+)?my\s+(.+?)\s+is\s+(.+)$/i,
        /^remember\s+(?:that\s+)?my\s+(.+?)\s+are\s+(.+)$/i
    ];

    for (const pattern of patterns) {

        const match = text.trim().match(pattern);

        if (match) {

            const key = normalizeKey(match[1]);
            const value = match[2].trim();

            if (
                key &&
                value &&
                key.length < 80 &&
                value.length < 300
            ) {

                FACTS[key] = value;

                saveFacts();

                return {
                    key: key,
                    value: value
                };
            }
        }
    }

    return null;
}


function findSavedFact(text) {

    const query = normalizeKey(text);

    const patterns = [
        /^what is my (.+)$/,
        /^what are my (.+)$/,
        /^tell me my (.+)$/,
        /^do you remember my (.+)$/,
        /^what was my (.+)$/
    ];

    for (const pattern of patterns) {

        const match = query.match(pattern);

        if (match) {

            const key = normalizeKey(match[1]);

            if (FACTS[key]) {

                return {
                    key: key,
                    value: FACTS[key]
                };
            }
        }
    }

    return null;
}


// ====================== 10. SIMPLE TOOLS ======================

async function handleTools(text) {

    const t = text.toLowerCase().trim();


    // TIME

    if (/\b(time|clock)\b/.test(t)) {

        return "The current time is " +
            new Date().toLocaleTimeString("en-IN") +
            ".";
    }


    // DATE

    if (/\b(date|today|day)\b/.test(t)) {

        return "Today is " +
            new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }) +
            ".";
    }


    // OPEN YOUTUBE

    if (/^(open\s+)?youtube$/i.test(text.trim())) {

        window.open(
            "https://www.youtube.com/",
            "_blank"
        );

        return "Opening YouTube.";
    }


    // OPEN GOOGLE

    if (/^(open\s+)?google$/i.test(text.trim())) {

        window.open(
            "https://www.google.com/",
            "_blank"
        );

        return "Opening Google.";
    }


    // GOOGLE SEARCH

    const googleMatch = text.match(
        /^(?:google search|search google for|search on google)\s+(.+)$/i
    );

    if (googleMatch) {

        const query = googleMatch[1].trim();

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching Google for " + query;
    }


    // YOUTUBE SEARCH

    const youtubeMatch = text.match(
        /^(?:play|youtube search|search youtube for)\s+(.+)$/i
    );

    if (youtubeMatch) {

        const query = youtubeMatch[1].trim();

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching YouTube for " + query;
    }


    // OPEN WEBSITE

    const urlMatch = text.match(
        /^(?:open|visit|go to)\s+(https?:\/\/\S+)$/i
    );

    if (urlMatch) {

        try {

            const url = new URL(urlMatch[1]);

            if (
                url.protocol === "https:" ||
                url.protocol === "http:"
            ) {

                window.open(
                    url.href,
                    "_blank"
                );

                return "Opening " + url.hostname;
            }

        } catch (e) {

            return "Invalid website address.";
        }
    }


    // NEWS

    if (/\bnews\b/i.test(t)) {

        window.open(
            "https://news.google.com/",
            "_blank"
        );

        return "Opening Google News.";
    }


    // CALCULATOR

    if (/\bcalculator\b/i.test(t)) {

        window.open(
            "https://www.google.com/search?q=calculator",
            "_blank"
        );

        return "Opening calculator.";
    }


    // HELP

    if (
        t === "help" ||
        t.includes("available commands")
    ) {

        return "You can ask me questions, tell me facts to remember, " +
            "ask for time or date, check weather, search Google, " +
            "search YouTube, open websites, or analyze images.";
    }

    return null;
}


// ====================== 11. WEATHER ======================

async function getWeather() {

    return new Promise((resolve, reject) => {

        if (!navigator.geolocation) {

            reject(
                new Error("Location is not supported.")
            );

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
                        "&current=temperature_2m";

                    const response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(
                            "Weather request failed."
                        );
                    }

                    const data = await response.json();

                    resolve(
                        "Current temperature is " +
                        data.current.temperature_2m +
                        " degrees Celsius."
                    );

                } catch (error) {

                    reject(error);
                }
            },

            () => {

                reject(
                    new Error(
                        "Please allow location access."
                    )
                );
            }
        );
    });
}


// ====================== 12. TIMER ======================

function handleTimer(text) {

    const match = text.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i
    );

    if (
        !match ||
        !text.toLowerCase().includes("timer")
    ) {
        return null;
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    let factor = 1000;

    if (/^(minutes?|mins?)$/.test(unit)) {
        factor = 60000;
    }

    if (/^(hours?|hrs?)$/.test(unit)) {
        factor = 3600000;
    }

    const milliseconds = amount * factor;

    if (milliseconds > 2147483647) {

        return "That timer is too long.";
    }

    setTimeout(() => {

        const message =
            "Your " +
            amount +
            " " +
            unit +
            " timer has finished.";

        add(message, "ai");

        speak(message);

    }, milliseconds);

    return "Timer set for " +
        amount +
        " " +
        unit +
        ".";
}


// ====================== 13. MAIN COMMAND ======================

let isBusy = false;


async function processCommand() {

    if (isBusy) return;

    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    add(text, "user");

    remember(text, "user");

    isBusy = true;

    setProcessing(true);

    try {


        // SAVE FACTS

        const saved = saveUserFact(text);

        if (saved) {

            const answer =
                "Understood. I will remember that your " +
                saved.key +
                " is " +
                saved.value +
                ".";

            add(answer, "ai");

            remember(answer, "model");

            speak(answer);

            return;
        }


        // RECALL FACTS

        const fact = findSavedFact(text);

        if (fact) {

            const answer =
                "Your " +
                fact.key +
                " is " +
                fact.value +
                ".";

            add(answer, "ai");

            remember(answer, "model");

            speak(answer);

            return;
        }


        // DIRECT TOOLS

        const toolResult = await handleTools(text);

        if (toolResult !== null) {

            add(toolResult, "ai");

            remember(toolResult, "model");

            speak(toolResult);

            return;
        }


        // TIMER

        const timerResult = handleTimer(text);

        if (timerResult) {

            add(timerResult, "ai");

            remember(timerResult, "model");

            speak(timerResult);

            return;
        }


        // WEATHER

        if (/\bweather\b/i.test(text)) {

            const weather = await getWeather();

            add(weather, "ai");

            remember(weather, "model");

            speak(weather);

            return;
        }


        // GEMINI AI

        const answer = await callGemini(text);

        add(answer, "ai");

        remember(answer, "model");

        speak(answer);


    } catch (error) {

        console.error("JARVIS ERROR:", error);

        add(
            "ERROR: " +
            error.message,
            "ai"
        );

        remember(
            "ERROR: " + error.message,
            "model"
        );

    } finally {

        isBusy = false;

        setProcessing(false);
    }
}


// ====================== 14. SEND BUTTON ======================

sendBtn.addEventListener(
    "click",
    processCommand
);


// ====================== 15. ENTER KEY ======================

input.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {

            event.preventDefault();

            processCommand();
        }
    }
);


// ====================== 16. VOICE INPUT ======================

let recognition = null;

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


if (SpeechRecognition) {

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";

    recognition.continuous = false;

    recognition.interimResults = false;


    recognition.onstart = function() {

        setStatus("LISTENING...");

        mic
