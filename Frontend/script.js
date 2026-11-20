/*
 J.A.R.V.I.S. bilingual English/Telugu voice assistant.
 IMPORTANT: A key in browser storage is visible to the person using the browser.
 For a public site, use a backend proxy and never commit an API key to GitHub.
*/
"use strict";

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const form = document.getElementById("chat-form");
const micBtn = document.getElementById("mic-btn");
const languageSelect = document.getElementById("language-select");
const aiStatus = document.getElementById("ai-status");
const networkStatus = document.getElementById("network-status");
const voiceStatus = document.getElementById("voice-status");
const speechStatus = document.getElementById("speech-status");

const API_KEY_STORAGE = "jarvis_gemini_key";
const MODEL_CANDIDATES = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
let apiKey = localStorage.getItem(API_KEY_STORAGE) || "";
let voices = [];
let recognition = null;
let preferredReplyLanguage = "auto";
let lastSpokenLanguage = "en-IN";

function setStatus(element, text, state = "wait") {
  element.textContent = text;
  element.className = state === "ok" ? "status-ok" :
    state === "error" ? "status-error" : "status-wait";
}

function addMessage(label, text, type = "assistant-message") {
  const article = document.createElement("article");
  article.className = `message ${type}`;
  const heading = document.createElement("div");
  heading.className = "message-label";
  heading.textContent = label;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(heading, paragraph);
  chat.appendChild(article);
  chat.scrollTop = chat.scrollHeight;
  return article;
}

function requestApiKey() {
  if (apiKey) return apiKey;
  const entered = window.prompt("Paste your Gemini API key (for local testing only):");
  if (!entered || !entered.trim()) return "";
  apiKey = entered.trim();
  localStorage.setItem(API_KEY_STORAGE, apiKey);
  return apiKey;
}

function languageInstruction() {
  const setting = languageSelect.value;
  if (setting === "te-IN") return "Reply only in natural Telugu (తెలుగు).";
  if (setting === "en-IN") return "Reply only in clear English.";
  return "Reply in the same language as the user's message. If the user writes or speaks Telugu, reply in Telugu. If the user uses English, reply in English. If the user mixes both, you may naturally mix both.";
}

async function callGemini(userText) {
  const key = requestApiKey();
  if (!key) throw new Error("Gemini API key was not entered. Reload the page and try again.");

  let lastError = null;
  for (const model of MODEL_CANDIDATES) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let response;
    let data;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are J.A.R.V.I.S., a capable, polite personal AI assistant. Address the user as Boss when natural. " +
                languageInstruction() +
                " Keep responses useful and conversational. Do not claim to control phone features unless a real integration exists."
            }]
          },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.65, maxOutputTokens: 900 }
        })
      });
      data = await response.json();
    } catch (error) {
      throw new Error("Could not reach Gemini. Check your internet connection and try again.");
    }

    if (!response.ok) {
      const message = data?.error?.message || `HTTP ${response.status}`;
      lastError = new Error(`${model}: ${message}`);
      // A missing/unsupported model may fall through to the next candidate.
      if (response.status === 404 || /model.*not found|not supported for generateContent/i.test(message)) {
        continue;
      }
      if (response.status === 400 && /API key|key not valid|invalid/i.test(message)) {
        throw new Error("The API key appears invalid. Check your key in Google AI Studio.");
      }
      if (response.status === 403) {
        throw new Error("Gemini access was denied. Check API key restrictions, project access and billing/quota.");
      }
      if (response.status === 429) {
        throw new Error("Gemini rate limit or quota reached. Wait a little and try again.");
      }
      throw lastError;
    }

    const candidate = data?.candidates?.[0];
    const answer = candidate?.content?.parts
      ?.map(part => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();

    if (!answer) {
      const reason = candidate?.finishReason || "No response text";
      throw new Error(`Gemini did not return a text answer (${reason}).`);
    }
    return answer;
  }
  throw lastError || new Error("No available Gemini model was found for this API key.");
}

function guessLanguage(text) {
  // Telugu Unicode block: U+0C00–U+0C7F
  return /[\u0C00-\u0C7F]/.test(text) ? "te-IN" : "en-IN";
}

function speak(text, language) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language || guessLanguage(text);
  utterance.rate = 0.96;
  utterance.pitch = 0.92;
  utterance.volume = 1;

  const langPrefix = utterance.lang.toLowerCase().split("-")[0];
  const chosenVoice = voices.find(voice =>
    voice.lang && voice.lang.toLowerCase().startsWith(langPrefix)
  );
  if (chosenVoice) utterance.voice = chosenVoice;
  lastSpokenLanguage = utterance.lang;
  window.speechSynthesis.speak(utterance);
}

async function sendToJarvis(text) {
  setStatus(aiStatus, "● THINKING");
  const pending = addMessage("J.A.R.V.I.S.", "Processing your request...", "assistant-message");
  try {
    const reply = await callGemini(text);
    pending.querySelector("p").textContent = reply;
    setStatus(aiStatus, "● ONLINE", "ok");
    speak(reply, guessLanguage(reply));
  } catch (error) {
    pending.querySelector("p").textContent = `Sorry, Boss. ${error.message}`;
    setStatus(aiStatus, "● ERROR", "error");
    console.error("J.A.R.V.I.S. error:", error);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addMessage("YOU", text, "user-message");
  input.value = "";
  sendToJarvis(text);
});

// Speech synthesis / spoken AI replies
function loadVoices() {
  if ("speechSynthesis" in window) voices = window.speechSynthesis.getVoices();
}
if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
  setStatus(speechStatus, "● AVAILABLE", "ok");
} else {
  setStatus(speechStatus, "○ NOT SUPPORTED", "error");
}

// Speech recognition / microphone input
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  function selectedRecognitionLanguage() {
    const selected = languageSelect.value;
    // Web Speech API requires one recognition language per session.
    // Auto reply mode defaults voice recognition to English (India); choose Telugu for Telugu speech.
    return selected === "auto" ? "en-IN" : selected;
  }

  recognition.onstart = () => {
    micBtn.classList.add("listening");
    micBtn.textContent = "●";
    setStatus(voiceStatus, "● LISTENING");
  };
  recognition.onresult = event => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim();
    if (!transcript) return;
    input.value = transcript;
    addMessage("YOU (VOICE)", transcript, "user-message");
    sendToJarvis(transcript);
  };
  recognition.onerror = event => {
    addMessage("J.A.R.V.I.S.", `Microphone error: ${event.error}. Check site microphone permission and try again.`, "assistant-message");
    setStatus(voiceStatus, "● MIC ERROR", "error");
  };
  recognition.onend = () => {
    micBtn.classList.remove("listening");
    micBtn.textContent = "🎙️";
    if (recognition) setStatus(voiceStatus, "● READY", "ok");
  };

  micBtn.addEventListener("click", () => {
    try {
      recognition.lang = selectedRecognitionLanguage();
      recognition.start();
    } catch (error) {
      console.warn("Speech recognition could not start:", error);
      addMessage("J.A.R.V.I.S.", "The microphone is busy. Wait a moment and tap the microphone again.", "assistant-message");
    }
  });
  setStatus(voiceStatus, "● AVAILABLE", "ok");
} else {
  micBtn.disabled = true;
  micBtn.title = "Speech recognition is not available in this browser.";
  setStatus(voiceStatus, "○ NOT SUPPORTED", "error");
}

languageSelect.addEventListener("change", () => {
  const value = languageSelect.value;
  if (value === "te-IN") {
    addMessage("J.A.R.V.I.S.", "తెలుగు వాయిస్ ఇన్‌పుట్ ఎంచుకున్నారు. ఇప్పుడు మైక్ నొక్కి మాట్లాడండి.", "assistant-message");
  } else if (value === "en-IN") {
    addMessage("J.A.R.V.I.S.", "English voice input selected. Tap the microphone and speak.", "assistant-message");
  } else {
    addMessage("J.A.R.V.I.S.", "Auto reply language selected. For voice input, choose English or Telugu explicitly if recognition uses the wrong language.", "assistant-message");
  }
});

document.getElementById("clear-chat").addEventListener("click", () => {
  chat.replaceChildren();
  addMessage("J.A.R.V.I.S.", "Conversation cleared, Boss. How can I help?", "assistant-message");
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
});

setStatus(networkStatus, navigator.onLine ? "● ONLINE" : "● OFFLINE", navigator.onLine ? "ok" : "error");
window.addEventListener("online", () => setStatus(networkStatus, "● ONLINE", "ok"));
window.addEventListener("offline", () => setStatus(networkStatus, "● OFFLINE", "error"));
