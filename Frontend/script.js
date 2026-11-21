/* =====================================================
   J.A.R.V.I.S. - PERSONAL AI ASSISTANT
   AI + MEMORY + VOICE + IMAGE ANALYSIS
===================================================== */

// ===== 1. API KEY =====

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    }
}

// Supported model fallback list
const MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite"
];

// ===== 2. MEMORY SYSTEM =====

let MEMORY = [];

try {
    MEMORY = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );

    if (!Array.isArray(MEMORY)) {
        MEMORY = [];
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

// ===== 4. DISPLAY SAVED MEMORY =====

function add(text, type) {
    if (!chat) return;

    const div = document.createElement("div");

    div.className = "msg " + type;
    div.innerText = text;

    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;

    return div;
}

MEMORY.forEach((m) => {
    add(
        (m.role === "user" ? "YOU: " : "J.A.R.V.I.S: ") +
        m.text,
        m.role === "user" ? "user" : "ai"
    );
});

// ===== 5. GEMINI AI ENGINE =====

async function callGemini(promptText) {

    if (!API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    const contents = MEMORY
        .slice(-12)
        .map((m) => ({
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

                const message =
                    data?.error?.message ||
                    "API request failed.";

                lastError = new Error(message);

                // Try next model for temporary or model errors
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

// ===== 6. CHAT WITH JARVIS =====

async function askGemini(promptText) {

    const loading = add(
        "J.A.R.V.I.S: Thinking...",
        "ai"
    );

    try {

        const reply = await callGemini(promptText);

        MEMORY.push({
            role: "user",
            text: promptText
        });

        MEMORY.push({
            role: "model",
            text: reply
        });

        // Keep memory from becoming too large
        MEMORY = MEMORY.slice(-40);

        saveMemory();

        loading.innerText = "J.A.R.V.I.S: " + reply;

        speak(reply);

    } catch (error) {

        loading.innerText =
            "J.A.R.V.I.S: ERROR - " + error.message;

        console.error("Gemini error:", error);
    }
}

// ===== 7. IMAGE ANALYSIS ENGINE =====

if (camBtn && imgInput) {

    camBtn.onclick = () => {
        imgInput.click();
    };

    imgInput.onchange = () => {

        const file = imgInput.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            add("SYSTEM: Please select an image file.", "ai");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            add("SYSTEM: Image must be smaller than 10 MB.", "ai");
            imgInput.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {

            const base64 = reader.result.split(",")[1];

            const question =
                input.value.trim() ||
                "Describe what you see in this image.";

            add("YOU: [IMAGE] " + question, "user");

            input.value = "";

            askVision(base64, file.type, question);
        };

        reader.onerror = () => {
            add("SYSTEM: Could not read image.", "ai");
        };

        reader.readAsDataURL(file);
    };
}

// ===== 8. VISION / IMAGE AI =====

async function askVision(base64, mimeType, question) {

    const loading = add(
        "J.A.R.V.I.S: Analyzing image...",
        "ai"
    );

    if (!API_KEY) {
        loading.innerText = "J.A.R.V.I.S: API key is missing.";
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

            loading.innerText = "J.A.R.V.I.S: " + reply;

            // Store image conversation as text memory
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

// ===== 9. VOICE RECOGNITION =====

const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SR && micBtn) {

    const rec = new SR();

    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event) => {

        const text =
            event.results[0][0].transcript;

        if (input) {
            input.value = text;
        }

        add("YOU: " + text, "user");

        askGemini(text);
    };

    rec.onerror = (event) => {

        add(
            "SYSTEM: Voice error - " + event.error,
            "ai"
        );
    };

    micBtn.onclick = () => {

        try {
            rec.start();
            micBtn.innerText = "LISTENING...";
        } catch (error) {
            console.warn("Voice recognition:", error);
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

// ===== 10. TEXT TO SPEECH =====

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

    if (!("speechSynthesis" in window)) return;

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

// ===== 11. SEND MESSAGE =====

if (sendBtn && input) {

    sendBtn.onclick = () => {

        const text = input.value.trim();

        if (!text) return;

        add("YOU: " + text, "user");

        input.value = "";

        askGemini(text);
    };
}

// Send message using Enter key
if (input) {

    input.addEventListener("keydown", (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            sendBtn?.click();
        }
    });
}

// ===== 12. CLEAR MEMORY =====

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

// ===== 13. SYSTEM READY =====

console.log("J.A.R.V.I.S. system initialized.");
