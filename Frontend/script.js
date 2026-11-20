
// =============== JARVIS AI - RETRY + BACKUP MODELS ===============

const $ = id => document.getElementById(id);

const chat = $("chat");
const msg = $("msg");
const send = $("send");
const mic = $("mic-btn");
const cam = $("cam-btn");
const clear = $("clear-btn");
const imgInput = $("img-input");
const coreText = $("core-text");

// First model is preferred. Others are fallbacks.
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API key:");

  if (API_KEY) {
    API_KEY = API_KEY.trim();
    localStorage.setItem("jarvis_key", API_KEY);
  }
}

// =============== MEMORY ===============

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

let memory = loadJSON("jarvis_memory", {});
let history = loadJSON("jarvis_history", []);
let busy = false;

function saveMemory() {
  localStorage.setItem("jarvis_memory", JSON.stringify(memory));
}

function saveHistory() {
  history = history.slice(-12);
  localStorage.setItem("jarvis_history", JSON.stringify(history));
}

// =============== UI ===============

function setStatus(value) {
  if (coreText) coreText.textContent = value;
}

function addMessage(text, sender) {
  if (!chat) return null;

  const div = document.createElement("div");
  div.className = sender;
  div.textContent = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  return div;
}

function setSendDisabled(disabled) {
  if (send) send.disabled = disabled;
}

// =============== PERSONAL MEMORY ===============

function storeFact(text) {
  const patterns = [
    {
      regex: /my favou?rite colou?r is\s+(.+)/i,
      key: "favourite_colour",
      label: "favourite colour"
    },
    {
      regex: /my favou?rite food is\s+(.+)/i,
      key: "favourite_food",
      label: "favourite food"
    },
    {
      regex: /my favou?rite movie is\s+(.+)/i,
      key: "favourite_movie",
      label: "favourite movie"
    },
    {
      regex: /my name is\s+(.+)/i,
      key: "user_name",
      label: "name"
    }
  ];

  for (const item of patterns) {
    const match = text.match(item.regex);

    if (match) {
      const value = match[1].trim().replace(/[.!?]+$/, "");

      memory[item.key] = value;
      saveMemory();

      return "I will remember your " + item.label + " is " + value + ".";
    }
  }

  return null;
}

function recallFact(text) {
  const q = text.toLowerCase();

  if (/favou?rite colou?r/.test(q) && memory.favourite_colour) {
    return "Your favourite colour is " + memory.favourite_colour + ".";
  }

  if (/favou?rite food/.test(q) && memory.favourite_food) {
    return "Your favourite food is " + memory.favourite_food + ".";
  }

  if (/favou?rite movie/.test(q) && memory.favourite_movie) {
    return "Your favourite movie is " + memory.favourite_movie + ".";
  }

  if (/what is my name|what's my name|who am i/.test(q) && memory.user_name) {
    return "Your name is " + memory.user_name + ".";
  }

  return null;
}

// =============== LOCAL TOOLS ===============

function handleTools(text) {
  const q = text.toLowerCase().trim();

  if (q === "time" || q.includes("what time")) {
    return "The time is " + new Date().toLocaleTimeString();
  }

  if (
    q === "date" ||
    q.includes("today's date") ||
    q.includes("what date")
  ) {
    return "Today is " + new Date().toLocaleDateString();
  }

  if (q.startsWith("google ") || q.startsWith("search ")) {
    const query = text.replace(/^(google|search)\s+/i, "");

    window.open(
      "https://www.google.com/search?q=" + encodeURIComponent(query),
      "_blank"
    );

    return "Searching Google for " + query;
  }

  if (q.startsWith("youtube ")) {
    const query = text.replace(/^youtube\s+/i, "");

    window.open(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query),
      "_blank"
    );

    return "Searching YouTube for " + query;
  }

  if (q.startsWith("calculate ")) {
    const expression = text.replace(/^calculate\s+/i, "");

    if (/^[\d+\-*/().%\s]+$/.test(expression)) {
      try {
        const result = Function(
          '"use strict";return (' + expression + ")"
        )();

        if (Number.isFinite(result)) {
          return "The answer is " + result;
        }
      } catch {
        return "I could not calculate that expression.";
      }
    }

    return "Please enter a valid calculation.";
  }

  return null;
}

// =============== WAIT / RETRY HELPERS ===============

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTemporaryError(status) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

// =============== GEMINI STREAMING ===============

async function askOneModel(model, prompt, onChunk, imageData) {
  const input = imageData
    ? [
        { type: "text", text: prompt },
        {
          type: "image",
          data: imageData.data,
          mime_type: imageData.mimeType
        }
      ]
    : prompt;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify({
        model: model,
        input: input,
        stream: true,
        store: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      let detail = errorText;

      try {
        const parsed = JSON.parse(errorText);
        detail = parsed.error?.message || errorText;
      } catch {}

      const error = new Error(
        "API " + response.status + ": " + detail
      );

      error.status = response.status;
      throw error;
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let answer = "";

    function processEvent(eventText) {
      const lines = eventText.split(/\r?\n/);

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const raw = line.slice(5).trim();

        if (!raw || raw === "[DONE]") continue;

        let event;

        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }

        if (event.event_type === "error" || event.error) {
          throw new Error(
            event.error?.message || "Gemini stream error."
          );
        }

        if (
          event.event_type === "step.delta" &&
          event.delta?.type === "text" &&
          typeof event.delta.text === "string"
        ) {
          answer += event.delta.text;
          onChunk(event.delta.text);
        }
      }
    }

    while (true) {
      const result = await reader.read();

      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";

      for (const eventText of events) {
        processEvent(eventText);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processEvent(buffer);
    }

    if (!answer.trim()) {
      throw new Error("The model returned an empty response.");
    }

    return answer.trim();

  } finally {
    clearTimeout(timeout);
  }
}

// =============== AUTOMATIC MODEL FALLBACK ===============

async function askGemini(question, onChunk, imageData = null) {
  if (!API_KEY) {
    throw new Error("Gemini API key is missing.");
  }

  const previous = history.slice(-8).map(item => ({
    role: item.role,
    text: item.text
  }));

  const prompt =
    "You are JARVIS, a helpful personal AI assistant. " +
    "Answer naturally and clearly. Keep ordinary answers concise. " +
    "Use these saved personal facts when relevant: " +
    JSON.stringify(memory) +
    "\nConversation:\n" +
    previous.map(x =>
      (x.role === "user" ? "User: " : "JARVIS: ") + x.text
    ).join("\n") +
    "\nUser: " + question;

  let lastError;

  for (const model of MODELS) {
    // Try each model up to two times for temporary errors.
    for (let attempt = 1; attempt <= 2; attempt++) {
      setStatus("CONNECTING " + model);

      try {
        const result = await askOneModel(
          model,
          prompt,
          onChunk,
          imageData
        );

        return result;

      } catch (error) {
        lastError = error;

        // Do not retry if the response has already started.
        // This avoids displaying duplicate streamed text.
        if (error.name === "AbortError") {
          throw new Error("Request timed out. Please try again.");
        }

        const temporary =
          error.status && isTemporaryError(error.status);

        if (!temporary) {
          // Try the next model for model-specific or access errors.
          break;
        }

        if (attempt < 2) {
          setStatus("RETRYING " + model);
          await wait(1500 * attempt);
        }
      }
    }
  }

  throw new Error(
    "All available models failed. Last error: " +
    (lastError?.message || "Unknown error") +
    ". Please try again later."
  );
}

// =============== SPEECH OUTPUT ===============

function speak(text) {
  if (!window.speechSynthesis) return;

  speechSynthesis.cancel();

  const speech = new SpeechSynthesisUtterance(text);
  speech.rate = 1.05;
  speech.pitch = 1;

  speechSynthesis.speak(speech);
}

// =============== MAIN SEND ===============

async function sendMessage(text, imageData = null) {
  text = (text || "").trim();

  if ((!text && !imageData) || busy) return;

  if (text) addMessage(text, "user");

  if (msg) msg.value = "";

  busy = true;
  setSendDisabled(true);
  setStatus("THINKING");

  let answer = "";
  let reply = null;

  try {
    answer = text ? storeFact(text) : null;

    if (!answer && text) {
      answer = recallFact(text);
    }

    if (!answer && text) {
      answer = handleTools(text);
    }

    if (answer) {
      addMessage(answer, "assistant");
    } else {
      reply = addMessage("", "assistant");

      answer = await askGemini(
        text || "Describe this image.",
        chunk => {
          if (reply) {
            reply.textContent += chunk;
          }

          if (chat) chat.scrollTop = chat.scrollHeight;

          setStatus("RESPONDING");
        },
        imageData
      );

      if (reply) reply.textContent = answer;
    }

    if (text) {
      history.push({ role: "user", text: text });
      history.push({ role: "assistant", text: answer });
      saveHistory();
    }

    if (answer) speak(answer);

  } catch (error) {
    const errorMessage = "JARVIS error: " + error.message;

    if (reply) {
      reply.textContent = errorMessage;
    } else {
      addMessage(errorMessage, "assistant");
    }

    setStatus("ERROR");
    console.error("JARVIS error:", error);

  } finally {
    busy = false;
    setSendDisabled(false);

    if (coreText && coreText.textContent !== "ERROR") {
      setStatus("ONLINE");
    }
  }
}

// =============== SEND BUTTON ===============

if (send) {
  send.addEventListener("click", () => {
    sendMessage(msg ? msg.value : "");
  });
}

if (msg) {
  msg.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(msg.value);
    }
  });
}

// =============== MICROPHONE ===============

if (mic) {
  mic.addEventListener("click", () => {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      addMessage(
        "Voice recognition is unavailable in this browser.",
        "assistant"
      );
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";

    recognition.onstart = () => setStatus("LISTENING");

    recognition.onresult = event => {
      sendMessage(event.results[0][0].transcript);
    };

    recognition.onerror = () => {
      setStatus("ONLINE");
      addMessage(
        "Microphone error. Check browser permission.",
        "assistant"
      );
    };

    recognition.onend = () => {
      if (!busy) setStatus("ONLINE");
    };

    recognition.start();
  });
}

// =============== CAMERA ===============

if (cam && imgInput) {
  cam.addEventListener("click", () => imgInput.click());
}

if (imgInput) {
  imgInput.addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addMessage("Please select an image.", "assistant");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const imageData = {
        mimeType: file.type,
        data: reader.result.split(",")[1]
      };

      sendMessage(
        msg ? msg.value.trim() : "Describe this image.",
        imageData
      );
    };

    reader.onerror = () => {
      addMessage("Could not read the selected image.", "assistant");
    };

    reader.readAsDataURL(file);
    imgInput.value = "";
  });
}

// =============== CLEAR CHAT ===============

if (clear) {
  clear.addEventListener("click", () => {
    history = [];
    localStorage.removeItem("jarvis_history");

    if (chat) chat.innerHTML = "";

    addMessage(
      "Chat cleared. Saved memories are preserved.",
      "assistant"
    );

    setStatus("ONLINE");
  });
}

// =============== RESTORE CHAT ===============

history.forEach(item => {
  addMessage(
    item.text,
    item.role === "user" ? "user" : "assistant"
  );
});

setStatus("ONLINE");

console.log("JARVIS READY. Available models:", MODELS);
