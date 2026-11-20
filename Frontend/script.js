
// =============== JARVIS FAST STREAMING AI ===============
// Gemini 3.8 Flash + Interactions API
// Progressive replies + instant memory + voice + camera

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

// =============== LOAD MEMORY ===============

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

      return "I will remember your " +
        item.label + " is " + value + ".";
    }
  }

  return null;
}

function recallFact(text) {
  const q = text.toLowerCase();

  if (
    /favou?rite colou?r/.test(q) &&
    memory.favourite_colour
  ) {
    return "Your favourite colour is " +
      memory.favourite_colour + ".";
  }

  if (
    /favou?rite food/.test(q) &&
    memory.favourite_food
  ) {
    return "Your favourite food is " +
      memory.favourite_food + ".";
  }

  if (
    /favou?rite movie/.test(q) &&
    memory.favourite_movie
  ) {
    return "Your favourite movie is " +
      memory.favourite_movie + ".";
  }

  if (
    /what is my name|what's my name|who am i/.test(q) &&
    memory.user_name
  ) {
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
      "https://www.google.com/search?q=" +
      encodeURIComponent(query),
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
  }

  return null;
}

// =============== STREAMING GEMINI API ===============

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
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify({
        model: MODEL,
        input: input,
        stream: true,
        store: false,
        generation_config: {
          max_output_tokens: 300,
          thinking_level: "low"
        }
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

      throw new Error("API " + response.status + ": " + detail);
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let answer = "";
    let gotText = false;

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

        if (event.error) {
          throw new Error(event.error.message || "Stream error");
        }

        if (event.event_type === "step.delta") {
          const delta = event.delta;

          if (delta && delta.type === "text" && delta.text) {
            gotText = true;
            answer += delta.text;
            onChunk(delta.text);
          }
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

    if (!gotText || !answer.trim()) {
      throw new Error("Gemini returned no text. Please try again.");
    }

    return answer.trim();

  } finally {
    clearTimeout(timeout);
  }
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

  try {
    // Local memory and commands need no network request.
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
      // Create an empty assistant bubble and fill it as chunks arrive.
      const reply = addMessage("", "assistant");

      setStatus("CONNECTING " + MODEL);

      answer = await askGemini(
        text || "Describe this image.",
        chunk => {
          reply.textContent += chunk;
          chat.scrollTop = chat.scrollHeight;

          setStatus("RESPONDING");
        },
        imageData
      );

      reply.textContent = answer;
    }

    if (text) {
      history.push({ role: "user", text: text });
      history.push({ role: "assistant", text: answer });
      saveHistory();
    }

    speak(answer);

  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "Gemini timed out after 45 seconds. Check your connection or API availability."
        : "JARVIS error: " + error.message;

    addMessage(message, "assistant");
    setStatus("ERROR");

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
      addMessage("Voice recognition is unavailable in this browser.", "assistant");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";

    recognition.onstart = () => setStatus("LISTENING");

    recognition.onresult = event => {
      const spoken = event.results[0][0].transcript;
      sendMessage(spoken);
    };

    recognition.onerror = () => {
      setStatus("ONLINE");
      addMessage("Microphone error. Check browser permission.", "assistant");
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

    addMessage("Chat cleared. Saved memories are preserved.", "assistant");
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
console.log("JARVIS STREAMING READY:", MODEL);
