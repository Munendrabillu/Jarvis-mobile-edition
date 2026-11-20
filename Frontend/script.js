// ======================================================
// J.A.R.V.I.S. - FIXED AI ASSISTANT
// ======================================================

// 1. GEMINI API KEY
let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");
    if (API_KEY) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    }
}

// Use a supported Gemini model
const MODEL = "gemini-3.8-flash";

// ======================================================
// 2. ELEMENTS
// ======================================================

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");
const coreText = document.getElementById("core-text");

// ======================================================
// 3. MEMORY
// ======================================================

let MEMORY = [];
let FACTS = {};

try {
    MEMORY = JSON.parse(localStorage.getItem("jarvis_memory") || "[]");
    FACTS = JSON.parse(localStorage.getItem("jarvis_facts") || "{}");

    if (!Array.isArray(MEMORY)) MEMORY = [];
    if (!FACTS || typeof FACTS !== "object") FACTS = {};

} catch (e) {
    MEMORY = [];
    FACTS = {};
}

function saveMemory() {
    localStorage.setItem("jarvis_memory", JSON.stringify(MEMORY));
    localStorage.setItem("jarvis_facts", JSON.stringify(FACTS));
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

function saveFact(key, value) {
    FACTS[key] = value;
    saveMemory();
}

function displaySavedChat() {
    MEMORY.forEach(message => {
        add(message.text, message.role === "user" ? "user" : "ai");
    });
}

// ======================================================
// 4. DISPLAY CHAT
// ======================================================

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

// ======================================================
// 5. SPEECH
// ======================================================

function speak(text) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-IN";
    speech.rate = 1;
    speech.pitch = 0.85;

    window.speechSynthesis.speak(speech);
}

// ======================================================
// 6. GEMINI API
// ======================================================

async function callGemini(prompt, imageBase64 = null, mimeType = "image/jpeg") {

    if (!API_KEY) {
        throw new Error("API key missing. Refresh and enter your API key.");
    }

    const contents = [];

    // Add recent conversation
    MEMORY.slice(-12).forEach(m => {
        contents.push({
            role: m.role,
            parts: [{ text: m.text }]
        });
    });

    // Add personal facts
    const factText = Object.keys(FACTS).length
        ? "Saved personal facts: " + JSON.stringify(FACTS)
        : "No personal facts have been saved.";

    // Add instructions and user prompt
    const parts = [{
        text:
            "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
            "Respond clearly and politely. " +
            "Use these saved personal facts when relevant: " +
            JSON.stringify(FACTS) +
            ". Conversation memory: " +
            factText +
            "\nUser request: " + prompt
    }];

    // Add image if supplied
    if (imageBase64) {
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

    const url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        MODEL +
        ":generateContent";

    const response = await fetch(url, {
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
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            "Gemini API error: " + response.status
        );
    }

    const answer =
        data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

    if (!answer) {
        throw new Error("Gemini returned an empty response.");
    }

    return answer;
}

// ======================================================
// 7. PERSONAL MEMORY
// ======================================================

function handlePersonalMemory(text) {

    const lower = text.toLowerCase();

    // Save a fact: My favourite colour is red
    const match = text.match(
        /^my\s+(?:favorite|favourite)\s+(.+?)\s+is\s+(.+)$/i
    );

    if (match) {
        const key = match[1].trim().toLowerCase();
        const value = match[2].trim();

        saveFact("favorite " + key, value);

        return "I will remember that your favorite " +
            key + " is " + value + ", Boss.";
    }

    // Save name
    const nameMatch = text.match(
        /^my name is\s+(.+)$/i
    );

    if (nameMatch) {
        saveFact("name", nameMatch[1].trim());
        return "I will remember your name, Boss.";
    }

    // Retrieve favourite
    if (
        lower.includes("what is my favourite") ||
        lower.includes("what is my favorite") ||
        lower.includes("what's my favourite") ||
        lower.includes("what's my favorite")
    ) {
        const keyMatch = text.match(
            /(?:favorite|favourite)\s+(.+?)(?:\?|$)/i
        );

        if (keyMatch) {
            const key = "favorite " + keyMatch[1].trim().toLowerCase();

            if (FACTS[key]) {
                return "Your " + keyMatch[1].trim() +
                    " is " + FACTS[key] + ", Boss.";
            }
        }

        return "I could not find that fact in my memory, Boss.";
    }

    // Retrieve name
    if (lower.includes("what is my name") || lower.includes("what's my name")) {
        if (FACTS.name) {
            return "Your name is " + FACTS.name + ", Boss.";
        }

        return "You have not told me your name yet, Boss.";
    }

    return null;
}

// ======================================================
// 8. SIMPLE TOOLS
// ======================================================

async function handleTools(text) {

    const t = text.toLowerCase().trim();

    // Time
    if (/\b(time|clock)\b/.test(t)) {
        return "The current time is " +
            new Date().toLocaleTimeString("en-IN") + ", Boss.";
    }

    // Date
    if (/\b(date|today|day)\b/.test(t)) {
        return "Today is " +
            new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }) + ", Boss.";
    }

    // Open YouTube
    if (/^(open\s+)?youtube$/i.test(t)) {
        window.open("https://www.youtube.com", "_blank");
        return "Opening YouTube, Boss.";
    }

    // Open Google
    if (/^(open\s+)?google$/i.test(t)) {
        window.open("https://www.google.com", "_blank");
        return "Opening Google, Boss.";
    }

    // Google search
    const googleMatch = text.match(
        /^(?:google search|search google for|search for)\s+(.+)$/i
    );

    if (googleMatch) {
        const query = googleMatch[1].trim();

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching Google for " + query + ", Boss.";
    }

    // YouTube search
    const playMatch = text.match(
        /^(?:play|youtube search)\s+(.+)$/i
    );

    if (playMatch) {
        const query = playMatch[1].trim();

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(query),
            "_blank"
        );

        return "Searching YouTube for " + query + ", Boss.";
    }

    // Open a URL
    const urlMatch = text.match(
        /^(?:open|visit|go to)\s+(https?:\/\/\S+)$/i
    );

    if (urlMatch) {
        window.open(urlMatch[1], "_blank");
        return "Opening your link, Boss.";
    }

    // News
    if (t.includes("news")) {
        window.open(
            "https://news.google.com/search?q=" +
            encodeURIComponent(text),
            "_blank"
        );

        return "Opening news, Boss.";
    }

    // Calculator
    if (t.includes("calculator")) {
        window.open(
            "https://www.google.com/search?q=calculator",
            "_blank"
        );

        return "Opening calculator, Boss.";
    }

    // Help
    if (t === "help" || t.includes("available commands")) {
        return "You can ask me questions, tell me facts to remember, " +
            "ask for time or date, open Google or YouTube, search, " +
            "use voice, or analyze an image, Boss.";
    }

    return null;
}

// ======================================================
// 9. MAIN COMMAND PROCESSOR
// ======================================================

let isProcessing = false;

async function processCommand() {

    const text = input.value.trim();

    if (!text || isProcessing) return;

    input.value = "";
    add(text, "user");
    remember(text, "user");

    isProcessing = true;

    if (coreText) coreText.textContent = "PROCESSING";

    try {

        // Personal memory commands
        const memoryResult = handlePersonalMemory(text);

        if (memoryResult) {
            add(memoryResult, "ai");
            remember(memoryResult, "model");
            speak(memoryResult);
            return;
        }

        // Simple tools
        const toolResult = await handleTools(text);

        if (toolResult !== null) {
            add(toolResult, "ai");
            remember(toolResult, "model");
            speak(toolResult);
            return;
        }

        // AI response
        const answer = await callGemini(text);

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

        isProcessing = false;

        if (coreText) {
            coreText.textContent = "SYSTEM READY";
        }
    }
}

// ======================================================
// 10. EXECUTE BUTTON
// ======================================================

sendBtn.addEventListener("click", processCommand);

// ======================================================
// 11. ENTER KEY
// ======================================================

input.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        event.preventDefault();
        processCommand();
    }
});

// ======================================================
// 12. MICROPHONE
// ======================================================

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
        if (coreText) coreText.textContent = "LISTENING";
        micBtn.textContent = "🔴";
    };

    recognition.onresult = function(event) {

        const voiceText =
            event.results[event.results.length - 1][0].transcript;

        input.value = voiceText;

        processCommand();
    };

    recognition.onerror = function(event) {

        console.error("Speech error:", event.error);

        add("Microphone error: " + event.error, "ai");
    };

    recognition.onend = function() {

        if (coreText) coreText.textContent = "SYSTEM READY";
        micBtn.textContent = "🎙️";
    };

    micBtn.addEventListener("click", function() {

        try {
            recognition.start();
        } catch (error) {
            console.error(error);
        }
    });

} else {

    micBtn.addEventListener("click", function() {
        add("Voice recognition is not supported in this browser. Try Chrome.", "ai");
    });
}

// ======================================================
// 13. CAMERA / IMAGE ANALYSIS
// ======================================================

camBtn.addEventListener("click", function() {
    imgInput.click();
});

imgInput.addEventListener("change", async function() {

    const file = imgInput.files[0];

    if (!file) return;

    add("Image selected: " + file.name, "user");

    if (coreText) coreText.textContent = "ANALYZING IMAGE";

    try {

        const base64 = await new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = function() {
                resolve(reader.result);
            };

            reader.onerror = reject;

            reader.readAsDataURL(file);
        });

        const imageData = base64.split(",")[1];

        const answer = await callGemini(
            "Describe and analyze this image.",
            imageData,
            file.type || "image/jpeg"
        );

        add(answer, "ai");
        remember("Image analysis: " + answer, "model");
        speak(answer);

    } catch (error) {

        console.error(error);

        add("Image error: " + error.message, "ai");

    } finally {

        if (coreText) coreText.textContent = "SYSTEM READY";
        imgInput.value = "";
    }
});

// ======================================================
// 14. CLEAR MEMORY
// ======================================================

clearBtn.addEventListener("click", function() {

    const confirmed = confirm(
        "Delete all saved chat and personal facts?"
    );

    if (!confirmed) return;

    MEMORY = [];
    FACTS = {};

    localStorage.removeItem("jarvis_memory");
    localStorage.removeItem("jarvis_facts");

    chat.innerHTML = "";

    add("Memory cleared, Boss.", "ai");
});

// ======================================================
// 15. START
// ======================================================

displaySavedChat();

console.log("J.A.R.V.I.S. loaded successfully.");
if (coreText) coreText.textContent = "SYSTEM READY";
