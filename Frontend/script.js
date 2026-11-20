// ========== JARVIS | INTERACTIONS API ==========

const $ = id => document.getElementById(id);
const chat = $("chat");
const msg = $("msg");
const send = $("send");
const mic = $("mic-btn");
const cam = $("cam-btn");
const clear = $("clear-btn");
const imgInput = $("img-input");
const coreText = $("core-text");

const MODEL = "gemini-3.8-flash";
let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
  API_KEY = prompt("Enter Gemini API key:");
  if (API_KEY) {
    API_KEY = API_KEY.trim();
    localStorage.setItem("jarvis_key", API_KEY);
  }
}

let memory = {};
let history = [];

try {
  memory = JSON.parse(localStorage.getItem("jarvis_memory") || "{}");
} catch {
  memory = {};
}

try {
  history = JSON.parse(localStorage.getItem("jarvis_history") || "[]");
} catch {
  history = [];
}

function setStatus(s) {
  if (coreText) coreText.textContent = s;
}

function saveMemory() {
  localStorage.setItem("jarvis_memory", JSON.stringify(memory));
}

function saveHistory() {
  history = history.slice(-10);
  localStorage.setItem("jarvis_history", JSON.stringify(history));
}

function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = sender;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function storeFact(text) {
  let m;

  m = text.match(/my favou?rite colou?r is\s+(.+)/i);
  if (m) {
    memory.favourite_colour = m[1].trim().replace(/[.!?]+$/, "");
    saveMemory();
    return "I will remember your favourite colour is " +
      memory.favourite_colour + ".";
  }

  m = text.match(/my favou?rite food is\s+(.+)/i);
  if (m) {
    memory.favourite_food = m[1].trim().replace(/[.!?]+$/, "");
    saveMemory();
    return "I will remember your favourite food is " +
      memory.favourite_food + ".";
  }

  m = text.match(/my name is\s+(.+)/i);
  if (m) {
    memory.user_name = m[1].trim().replace(/[.!?]+$/, "");
    saveMemory();
    return "I will remember your name.";
  }

  return null;
}

function recallFact(text) {
  const t = text.toLowerCase();

  if (
    t.includes("favourite colour") ||
    t.includes("favorite color") ||
    t.includes("favourite color") ||
    t.includes("favorite colour")
  ) {
    if (memory.favourite_colour) {
      return "Your favourite colour is " +
        memory.favourite_colour + ".";
    }
  }

  if (t.includes("favourite food") || t.includes("favorite food")) {
    if (memory.favourite_food) {
      return "Your favourite food is " +
        memory.favourite_food + ".";
    }
  }

  if (
    t.includes("what is my name") ||
    t.includes("what's my name") ||
    t.includes("who am i")
  ) {
    if (memory.user_name) {
      return "Your name is " + memory.user_name + ".";
    }
  }

  return null;
}

async function handleTools(text) {
  const t = text.toLowerCase().trim();

  if (/\btime\b/.test(t)) {
    return "The time is " + new Date().toLocaleTimeString();
  }

  if (
    t.includes("today's date") ||
    t.includes("what date") ||
    t === "date"
  ) {
    return "Today is " + new Date().toLocaleDateString();
  }

  if (t.startsWith("google ") || t.startsWith("search ")) {
    const q = text.replace(/^(google|search)\s+/i, "");
    window.open(
      "https://www.google.com/search?q=" +
      encodeURIComponent(q),
      "_blank"
    );
    return "Searching Google for " + q;
  }

  if (t.startsWith("youtube ")) {
    const q = text.replace(/^youtube\s+/i, "");
    window.open(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(q),
      "_blank"
    );
    return "Searching YouTube for " + q;
  }

  if (t.startsWith("wiki ")) {
    const q = text.replace(/^wiki\s+/i, "");
    window.open(
      "https://en.wikipedia.org/wiki/Special:Search?search=" +
      encodeURIComponent(q),
      "_blank"
    );
    return "Searching Wikipedia for " + q;
  }

  if (t.startsWith("calculate ")) {
    const exp = text.replace(/^calculate\s+/i, "");

    if (/^[\d+\-*/().%\s]+$/.test(exp)) {
      try {
        const result = Function(
          '"use strict";return (' + exp + ')'
        )();

        if (Number.isFinite(result)) {
          return "Answer: " + result;
        }
      } catch {
        return "Calculation error.";
      }
    }
  }

  return null;
}

// ========== INTERACTIONS API ==========

async function askGemini(question, imageData = null) {
  if (!API_KEY) return "API key missing.";

  // Include a small amount of history in the input.
  const context = history.slice(-6).map(item =>
    item.role === "user"
      ? "User: " + item.text
      : "JARVIS: " + item.text
  ).join("\n");

  const input = [];

  input.push({
    type: "text",
    text:
      "You are JARVIS, a helpful personal AI assistant. " +
      "Answer naturally, briefly and accurately. " +
      "Use the user's saved facts when relevant. " +
      "Saved memory: " + JSON.stringify(memory) + "\n" +
      context + "\nCurrent user message: " + question
  });

  if (imageData) {
    input.push({
      type: "image",
      data: imageData.data,
      mime_type: imageData.mimeType
    });
  }

  try {
    setStatus("CONNECTING");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          model: MODEL,
          input: input,
          store: false,
          generation_config: {
            max_output_tokens: 512,
            thinking_level: "low"
          }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timer);

    const data = await response.json();

    if (!response.ok) {
      return "API Error " + response.status + ": " +
        (data.error?.message || JSON.stringify(data));
    }

    // Extract output from Interactions response.
    if (data.output_text) {
      return data.output_text.trim();
    }

    let texts = [];

    if (Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (step.type === "model_output") {
          for (const item of (step.content || [])) {
            if (item.type === "text" && item.text) {
              texts.push(item.text);
            }
          }
        }
      }
    }

    if (texts.length) {
      return texts.join("\n").trim();
    }

    if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "text" && item.text) {
          texts.push(item.text);
        }
      }
    }

    if (texts.length) {
      return texts.join("\n").trim();
    }

    return "Gemini returned no readable text. " +
      JSON.stringify(data).slice(0, 500);

  } catch (e) {
    if (e.name === "AbortError") {
      return "Request timed out. Please try again.";
    }

    return "Connection failed: " + e.message;
  }
}

// ========== VOICE OUTPUT ==========

function speak(text) {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

// ========== MAIN MESSAGE ==========

async function sendMessage(text, imageData = null) {
  text = (text || "").trim();

  if (!text && !imageData) return;

  if (text) addMessage(text, "user");

  if (msg) msg.value = "";

  setStatus("THINKING");

  try {
    let answer = null;

    if (text) answer = storeFact(text);
    if (!answer && text) answer = recallFact(text);
    if (!answer && text) answer = await handleTools(text);

    if (!answer) {
      answer = await askGemini(text, imageData);
    }

    addMessage(answer, "assistant");

    if (text) {
      history.push({ role: "user", text });
      history.push({ role: "assistant", text: answer });
      saveHistory();
    }

    speak(answer);

  } catch (e) {
    addMessage("Error: " + e.message, "assistant");
  }

  setStatus("ONLINE");
}

// ========== SEND ==========

if (send) {
  send.addEventListener("click", () => sendMessage(msg.value));
}

if (msg) {
  msg.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(msg.value);
    }
  });
}

// ========== MIC ==========

if (mic) {
  mic.addEventListener("click", () => {
    const SR = window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SR) {
      addMessage("Speech recognition unavailable.", "assistant");
      return;
    }

    const r = new SR();
    r.lang = "en-IN";

    r.onstart = () => setStatus("LISTENING");

    r.onresult = e => {
      const spoken = e.results[0][0].transcript;
      msg.value = spoken;
      sendMessage(spoken);
    };

    r.onerror = () =>
      addMessage("Microphone error.", "assistant");

    r.onend = () => setStatus("ONLINE");

    r.start();
  });
}

// ========== CAMERA ==========

if (cam && imgInput) {
  cam.addEventListener("click", () => imgInput.click());
}

if (imgInput) {
  imgInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addMessage("Select an image file.", "assistant");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const imageData = {
        mimeType: file.type,
        data: reader.result.split(",")[1]
      };

      sendMessage(
        msg.value.trim() || "Describe this image.",
        imageData
      );
    };

    reader.readAsDataURL(file);
    imgInput.value = "";
  });
}

// ========== CLEAR CHAT ==========

if (clear) {
  clear.addEventListener("click", () => {
    history = [];
    localStorage.removeItem("jarvis_history");
    chat.innerHTML = "";
    addMessage("Chat cleared. Memory is preserved.", "assistant");
    setStatus("ONLINE");
  });
}

// ========== RESTORE ==========

history.forEach(item => {
  addMessage(
    item.text,
    item.role === "user" ? "user" : "assistant"
  );
});

setStatus("ONLINE");
console.log("JARVIS INTERACTIONS API READY");
