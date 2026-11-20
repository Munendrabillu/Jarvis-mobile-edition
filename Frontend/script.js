
// ======================================
// J.A.R.V.I.S. - GEMINI AI ASSISTANT
// ======================================

// 1. API CONFIGURATION
const API_KEY = localStorage.getItem("jarvis_key") ||
                prompt("Enter your Gemini API Key:");

if (API_KEY) {
  localStorage.setItem("jarvis_key", API_KEY);
}

// Use a currently documented Gemini model.
// Change this if your Google AI Studio account
// does not have access to this model.
const MODEL = "gemini-3.8-flash";

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const micBtn = document.getElementById("mic-btn");
const sendBtn = document.getElementById("send");

// 2. CHAT DISPLAY
function add(message, who) {
  const d = document.createElement("div");
  d.className = "msg " + who;
  d.innerText = message;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}

// 3. GEMINI AI CONNECTION
async function callGemini(promptText) {
  if (!API_KEY) {
    throw new Error("Gemini API key is missing.");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: "You are J.A.R.V.I.S., a helpful personal AI assistant. Address the user as Boss. Give clear, friendly and concise answers."
        }]
      },
      contents: [{
        role: "user",
        parts: [{ text: promptText }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || `API error: ${response.status}`
    );
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!reply) {
    throw new Error("Gemini returned an empty response.");
  }

  return reply;
}

// 4. ASK JARVIS
async function askGemini(message) {
  const thinking = add(
    "J.A.R.V.I.S: Thinking...",
    "ai"
  );

  try {
    const reply = await callGemini(message);

    thinking.innerText = "J.A.R.V.I.S: " + reply;

    speak(reply);

  } catch (error) {
    thinking.innerText =
      "J.A.R.V.I.S ERROR: " + error.message;

    console.error(error);
  }
}

// 5. TEXT TO SPEECH
let voices = [];

function loadVoices() {
  voices = window.speechSynthesis
    ? speechSynthesis.getVoices()
    : [];
}

if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis is not supported.");
    return;
  }

  speechSynthesis.cancel();

  const speech = new SpeechSynthesisUtterance(text);
  speech.rate = 1.0;
  speech.pitch = 0.9;
  speech.volume = 1;

  const voice = voices.find(v =>
    v.lang.toLowerCase().startsWith("en")
  );

  if (voice) speech.voice = voice;

  speechSynthesis.speak(speech);
}

// 6. SPEECH RECOGNITION
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    micBtn.innerText = "LISTENING...";
    micBtn.classList.add("listening");
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;

    input.value = text;

    add("YOU: " + text, "user");

    askGemini(text);
  };

  recognition.onerror = (event) => {
    add("MIC ERROR: " + event.error, "ai");
  };

  recognition.onend = () => {
    micBtn.innerText = "🎙️";
    micBtn.classList.remove("listening");
  };

} else {
  micBtn.disabled = true;
  micBtn.innerText = "MIC OFF";
  micBtn.title = "Speech recognition is not supported.";
}

// 7. MICROPHONE BUTTON
micBtn.addEventListener("click", () => {
  if (recognition) {
    try {
      recognition.start();
    } catch (error) {
      console.error(error);
    }
  }
});

// 8. SEND BUTTON
function sendMessage() {
  const text = input.value.trim();

  if (!text) return;

  add("YOU: " + text, "user");

  input.value = "";

  askGemini(text);
}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});
