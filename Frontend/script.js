
/* ==========================================
   1. API KEY SETUP
========================================== */

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    }
}

/* ==========================================
   2. GEMINI MODELS
========================================== */

// Models are tried in order.
// Availability may change; an unavailable model is skipped.

const MODELS = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"
];


/* ==========================================
   3. MEMORY SYSTEM
========================================== */

let MEMORY = [];

try {
    MEMORY = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );
} catch (error) {
    MEMORY = [];
}

function saveMemory() {
    localStorage.setItem(
        "jarvis_memory",
        JSON.stringify(MEMORY)
    );
}


/* ==========================================
   4. HTML ELEMENTS
========================================== */

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");

const micBtn = document.getElementById("mic-btn");
const clearBtn = document.getElementById("clear-btn");

const camBtn = document.getElementById("cam-btn");
const imgInput = document.getElementById("img-input");


/* ==========================================
   5. DISPLAY SAVED CHAT
========================================== */

MEMORY.forEach(function (m) {
    add(
        (m.role === "user" ? "YOU: " : "J.A.R.V.I.S: ") +
        m.text,
        m.role === "user" ? "user" : "ai"
    );
});


/* ==========================================
   6. GEMINI API FUNCTION
========================================== */

async function callGemini(promptText) {

    if (!API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    const contents = MEMORY.slice(-12).map(function (m) {
        return {
            role: m.role,
            parts: [{ text: m.text }]
        };
    });

    // Add the current message
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
                    contents: contents
                })
            });

            const data = await response.json();

            // Handle API errors
            if (!response.ok || data.error) {

                const message =
                    data.error?.message ||
                    "HTTP error " + response.status;

                lastError = new Error(message);

                // Try another model on model-related errors
                if (
                    response.status === 404 ||
                    response.status === 429 ||
                    response.status === 503 ||
                    response.status === 500
                ) {
                    continue;
                }

                throw lastError;
            }

            // Check if response exists
            const candidate = data.candidates?.[0];

            if (!candidate) {
                throw new Error(
                    "The AI returned no response. " +
                    (data.promptFeedback?.blockReason || "")
                );
            }

            const parts = candidate.content?.parts || [];

            const reply = parts
                .filter(part => part.text)
                .map(part => part.text)
                .join("\n");

            if (!reply) {
                throw new Error("Empty AI response.");
            }

            return reply;

        } catch (error) {

            lastError = error;

        }
    }

    throw lastError || new Error("All Gemini models failed.");
}


/* ==========================================
   7. ASK JARVIS
========================================== */

async function askGemini(promptText) {

    const thinking = add(
        "J.A.R.V.I.S: Thinking...",
        "ai"
    );

    try {

        const reply = await callGemini(promptText);

        // Save conversation
        MEMORY.push({
            role: "user",
            text: promptText
        });

        MEMORY.push({
            role: "model",
            text: reply
        });

        // Keep memory manageable
        MEMORY = MEMORY.slice(-40);

        saveMemory();

        // Display response
        thinking.innerText = "J.A.R.V.I.S: " + reply;

        speak(reply);

    } catch (error) {

        thinking.innerText =
            "J.A.R.V.I.S: ERROR - " + error.message;

        console.error("Gemini error:", error);
    }
}


/* ==========================================
   8. IMAGE UPLOAD BUTTON
========================================== */

if (camBtn && imgInput) {

    camBtn.onclick = function () {
        imgInput.click();
    };

    imgInput.onchange = function () {

        const file = imgInput.files[0];

        if (!file) return;

        // Check image type
        if (!file.type.startsWith("image/")) {
            add("SYSTEM: Please select an image file.", "ai");
            imgInput.value = "";
            return;
        }

        // Check image size (10 MB limit)
        if (file.size > 10 * 1024 * 1024) {
            add("SYSTEM: Image must be smaller than 10 MB.", "ai");
            imgInput.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = function () {

            const base64 = reader.result.split(",")[1];

            const question =
                input.value.trim() ||
                "What do you see in this image? Describe it.";

            add("YOU: [IMAGE] " + question, "user");

            input.value = "";

            askVision(base64, file.type, question);
        };

        reader.onerror = function () {
            add("SYSTEM: Unable to read image.", "ai");
        };

        reader.readAsDataURL(file);
    };
}


/* ==========================================
   9. IMAGE ANALYSIS
========================================== */

async function askVision(base64, mime, question) {

    const thinking = add(
        "J.A.R.V.I.S: Analyzing image...",
        "ai"
    );

    if (!API_KEY) {
        thinking.innerText =
            "J.A.R.V.I.S: ERROR - Missing API key.";
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
                                {
                                    text: question
                                },
                                {
                                    inline_data: {
                                        mime_type: mime,
                                        data: base64
                                    }
                                }
                            ]
                        }
                    ]

                })

            });

            const data = await response.json();

            if (!response.ok || data.error) {

                lastError = new Error(
                    data.error?.message ||
                    "HTTP error " + response.status
                );

                if (
                    response.status === 404 ||
                    response.status === 429 ||
                    response.status === 503 ||
                    response.status === 500
                ) {
                    continue;
                }

                throw lastError;
            }

            const candidate = data.candidates?.[0];

            if (!candidate) {
                throw new Error("No image analysis response.");
            }

            const reply = candidate.content?.parts
                ?.filter(part => part.text)
                .map(part => part.text)
                .join("\n");

            if (!reply) {
                throw new Error("Empty image response.");
            }

            // Save image question and answer to memory
            MEMORY.push({
                role: "user",
                text: "[Image uploaded] " + question
            });

            MEMORY.push({
                role: "model",
                text: reply
            });

            MEMORY = MEMORY.slice(-40);

            saveMemory();

            thinking.innerText = "J.A.R.V.I.S: " + reply;

            speak(reply);

            return;

        } catch (error) {

            lastError = error;

        }
    }

    thinking.innerText =
        "J.A.R.V.I.S: ERROR - " +
        (lastError?.message || "Image analysis failed.");

    console.error("Vision error:", lastError);
}


/* ==========================================
   10. VOICE INPUT
========================================== */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = function (event) {

        const transcript =
            event.results[0][0].transcript;

        input.value = transcript;

        add("YOU: " + transcript, "user");

        askGemini(transcript);

    };

    recognition.onerror = function (event) {

        console.error("Speech recognition error:", event.error);

        add(
            "SYSTEM: Voice recognition error - " +
            event.error,
            "ai"
        );

    };

    micBtn.onclick = function () {

        try {
            recognition.start();
            micBtn.innerText = "LISTENING...";
        } catch (error) {
            console.log(error);
        }

    };

    recognition.onend = function () {
        micBtn.innerText = "🎙️";
    };

} else if (micBtn) {

    micBtn.onclick = function () {

        add(
            "SYSTEM: Voice input is not supported in this browser.",
            "ai"
        );

    };

}


/* ==========================================
   11. VOICE OUTPUT
========================================== */

let voices = [];

function loadVoices() {
    voices = speechSynthesis.getVoices();
}

loadVoices();

if ("speechSynthesis" in window) {

    speechSynthesis.onvoiceschanged = loadVoices;

}

function speak(text) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    // Stop previous speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1.05;
    utterance.pitch = 0.85;
    utterance.volume = 1;

    const voice = voices.find(function (v) {
        return v.lang.toLowerCase().startsWith("en");
    });

    if (voice) {
        utterance.voice = voice;
    }

    speechSynthesis.speak(utterance);
}


/* ==========================================
   12. SEND MESSAGE
========================================== */

if (sendBtn) {

    sendBtn.onclick = function () {

        const text = input.value.trim();

        if (!text) return;

        add("YOU: " + text, "user");

        input.value = "";

        askGemini(text);
    };
}


/* ==========================================
   13. ENTER KEY TO SEND
========================================== */

if (input) {

    input.addEventListener("keydown", function (event) {

        if (event.key === "Enter") {

            event.preventDefault();

            sendBtn.click();

        }

    });

}


/* ==========================================
   14. CLEAR MEMORY
========================================== */

if (clearBtn) {

    clearBtn.onclick = function () {

        MEMORY = [];

        saveMemory();

        chat.innerHTML = "";

        speechSynthesis.cancel();

        add("SYSTEM: Memory cleared.", "ai");

    };

}


/* ==========================================
   15. CHAT MESSAGE FUNCTION
========================================== */

function add(text, who) {

    const div = document.createElement("div");

    div.className = "msg " + who;

    div.innerText = text;

    chat.appendChild(div);

    chat.scrollTop = chat.scrollHeight;

    return div;

}
