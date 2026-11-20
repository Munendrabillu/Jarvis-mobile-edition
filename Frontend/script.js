// ================= JARVIS FAST AI =================
// Faster Gemini replies + instant personal memory
// Replace your complete script.js with this code.

const $ = id => document.getElementById(id);

const chat = $("chat");
const msg = $("msg");
const send = $("send");
const mic = $("mic-btn");
const cam = $("cam-btn");
const clear = $("clear-btn");
const imgInput = $("img-input");
const coreText = $("core-text");

// ---------- API KEY ----------
let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API Key:");
  if (API_KEY) {
    localStorage.setItem("jarvis_key", API_KEY.trim());
  }
}

// ---------- SETTINGS ----------
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];

const SYSTEM_PROMPT = `
You are JARVIS, a fast, helpful personal AI assistant.
Answer clearly, naturally, and concisely.
Use the conversation context to answer personal questions.
Do not repeat the user's question unnecessarily.
`;

// ---------- MEMORY ----------
let memory = JSON.parse(
  localStorage.getItem("jarvis_memory") || "{}"
);

function saveMemory() {
  localStorage.setItem(
    "jarvis_memory",
    JSON.stringify(memory)
  );
}

function rememberFact(key, value) {
  memory[key] = value;
  saveMemory();
}

function recallFact(key) {
  return memory[key] || null;
}

// ---------- CHAT HISTORY ----------
let history = JSON.parse(
  localStorage.getItem("jarvis_history") || "[]"
);

function saveHistory() {
  // Keep only the latest 8 exchanges for speed
  history = history.slice(-16);
  localStorage.setItem(
    "jarvis_history",
    JSON.stringify(history)
  );
}

// ---------- UI ----------
function addMessage(text, sender) {
  const div = document.createElement("div");

  div.className = sender;
  div.textContent = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  return div;
}

function setStatus(text) {
  if (coreText) coreText.textContent = text;
}

function cleanText(text) {
  return String(text || "").trim();
}

// ---------- INSTANT MEMORY SEARCH ----------
function memoryAnswer(question) {
  const q = question.toLowerCase().trim();

  // Favourite colour
  if (
    q.includes("favourite colour") ||
    q.includes("favorite color") ||
    q.includes("favourite color") ||
    q.includes("favorite colour")
  ) {
    if (memory.favourite_colour) {
      return "Your favourite colour is " +
        memory.favourite_colour + ".";
    }
  }

  // Favourite food
  if (
    q.includes("favourite food") ||
    q.includes("favorite food")
  ) {
    if (memory.favourite_food) {
      return "Your favourite food is " +
        memory.favourite_food + ".";
    }
  }

  // Favourite movie
  if (
    q.includes("favourite movie") ||
    q.includes("favorite movie")
  ) {
    if (memory.favourite_movie) {
      return "Your favourite movie is " +
        memory.favourite_movie + ".";
    }
  }

  // Favourite name / nickname
  if (
    q.includes("my name") ||
    q.includes("what do you call me")
  ) {
    if (memory.user_name) {
      return "Your name is " + memory.user_name + ".";
    }
  }

  return null;
}

// ---------- STORE USER FACTS ----------
function storeFact(text) {
  const t = text.trim();

  let match;

  match = t.match(
    /my favou?rite colou?r is\s+(.+)/i
  );

  if (match) {
    rememberFact(
      "favourite_colour",
      match[1].trim().replace(/[.!?]+$/, "")
    );

    return "I will remember that your favourite colour is " +
      memory.favourite_colour + ".";
  }

  match = t.match(
    /my favou?rite food is\s+(.+)/i
  );

  if (match) {
    rememberFact(
      "favourite_food",
      match[1].trim().replace(/[.!?]+$/, "")
    );

    return "I will remember your favourite food is " +
      memory.favourite_food + ".";
  }

  match = t.match(
    /my favou?rite movie is\s+(.+)/i
  );

  if (match) {
    rememberFact(
      "favourite_movie",
      match[1].trim().replace(/[.!?]+$/, "")
    );

    return "I will remember your favourite movie is " +
      memory.favourite_movie + ".";
  }

  match = t.match(
    /my name is\s+(.+)/i
  );

  if (match) {
    rememberFact(
      "user_name",
      match[1].trim().replace(/[.!?]+$/, "")
    );

    return "Nice to meet you. I will remember your name.";
  }

  return null;
}

// ---------- LOCAL TOOLS ----------
async function handleTools(text) {
  const t = text.toLowerCase().trim();

  // Time
  if (/\btime\b/.test(t)) {
    return "The current time is " +
      new Date().toLocaleTimeString();
  }

  // Date
  if (
    t.includes("today's date") ||
    t.includes("what date") ||
    t === "date"
  ) {
    return "Today is " +
      new Date().toLocaleDateString();
  }

  // Google search
  if (
    t.startsWith("search ") ||
    t.startsWith("google ")
  ) {
    const query = text.replace(/^(search|google)\s+/i, "");

    window.open(
      "https://www.google.com/search?q=" +
      encodeURIComponent(query),
      "_blank"
    );

    return "Searching Google for " + query;
  }

  // YouTube
  if (t.startsWith("youtube ")) {
    const query = text.replace(/^youtube\s+/i, "");

    window.open(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query),
      "_blank"
    );

    return "Searching YouTube for " + query;
  }

  // Wikipedia
  if (t.startsWith("wiki ")) {
    const query = text.replace(/^wiki\s+/i, "");

    window.open(
      "https://en.wikipedia.org/wiki/Special:Search?search=" +
      encodeURIComponent(query),
      "_blank"
    );

    return "Searching Wikipedia for " + query;
  }

  // Calculator
  if (t.startsWith("calculate ")) {
    const expression = text.replace(/^calculate\s+/i, "");

    // Safe, limited arithmetic parser
    if (/^[\d\s()+\-*/.%]+$/.test(expression)) {
      try {
        const result = Function(
          '"use strict";return (' +
          expression + ')'
        )();

        if (Number.isFinite(result)) {
          return "The answer is " + result;
        }
      } catch (e) {
        return "I couldn't calculate that expression.";
      }
    }

    return "Please enter a valid mathematical expression.";
  }

  return null;
}

// ---------- FAST GEMINI REQUEST ----------
async function askGemini(question, imageData = null) {
  if (!API_KEY) {
    return "Please enter your Gemini API key.";
  }

  // Short context = faster responses
  const recentHistory = history.slice(-6);

  const contents = [];

  for (const item of recentHistory) {
    contents.push({
      role: item.role,
      parts: [{ text: item.text }]
    });
  }

  const parts = [];

  parts.push({
    text:
      SYSTEM_PROMPT +
      "\nKnown personal facts: " +
      JSON.stringify(memory) +
      "\nUser message: " + question
  });

  if (imageData) {
    parts.push({
      inline_data: {
        mime_type: imageData.mimeType,
        data: imageData.data
      }
    });
  }

  contents.push({
    role: "user",
    parts: parts
  });

  let lastError = "";

  for (const model of MODELS) {
    try {
      setStatus("CONNECTING " + model);

      const controller = new AbortController();

      const timeout = setTimeout(
        () => controller.abort(),
        20000
      );

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
        encodeURIComponent(API_KEY),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: contents,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 300
            }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      const data = await response.json();

      if (!response.ok) {
        lastError =
          data.error?.message ||
          "Gemini request failed.";

        // Move to the next model if the model is unavailable
        if (
          response.status === 404 ||
          response.status === 400
        ) {
          continue;
        }

        // Don't waste time with long retry loops
        if (
          response.status === 429 ||
          response.status === 503
        ) {
          return "Gemini is busy right now. Please try again in a few seconds.";
        }

        return "Gemini error: " + lastError;
      }

      const answer =
        data.candidates?.[0]?.content?.parts
          ?.map(p => p.text || "")
          .join("")
          .trim();

      if (answer) {
        return answer;
      }

      lastError = "Gemini returned an empty response.";

    } catch (error) {
      lastError = error.name === "AbortError"
        ? "Request timed out."
        : error.message;
    }
  }

  return "Connection failed. " + lastError;
}

// ---------- SPEECH OUTPUT ----------
function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

// ---------- MAIN SEND FUNCTION ----------
async function sendMessage(text, imageData = null) {
  text = cleanText(text);

  if (!text && !imageData) return;

  if (text) {
    addMessage(text, "user");
  }

  msg.value = "";

  setStatus("PROCESSING");

  try {
    let answer = null;

    // 1. Save information locally immediately
    if (text) {
      answer = storeFact(text);
    }

    // 2. Handle local tools
    if (!answer && text) {
      answer = await handleTools(text);
    }

    // 3. Memory search - instant response
    if (!answer && text) {
      answer = memoryAnswer(text);
    }

    // 4. Gemini only when needed
    if (!answer) {
      answer = await askGemini(text, imageData);
    }

    addMessage(answer, "assistant");

    // Only send normal conversation to history
    if (text) {
      history.push({
        role: "user",
        text: text
      });

      history.push({
        role: "model",
        text: answer
      });

      saveHistory();
    }

    speak(answer);

  } catch (error) {
    addMessage(
      "Error: " + error.message,
      "assistant"
    );
  } finally {
    setStatus("ONLINE");
  }
}

// ---------- SEND BUTTON ----------
if (send) {
  send.addEventListener("click", () => {
    sendMessage(msg.value);
  });
}

// ---------- ENTER KEY ----------
if (msg) {
  msg.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage(msg.value);
    }
  });
}

// ---------- MICROPHONE ----------
if (mic) {
  mic.addEventListener("click", () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addMessage(
        "Voice recognition is not supported in this browser.",
        "assistant"
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setStatus("LISTENING");
    };

    recognition.onresult = event => {
      const transcript =
        event.results[0][0].transcript;

      msg.value = transcript;
      sendMessage(transcript);
    };

    recognition.onerror = () => {
      setStatus("ONLINE");
      addMessage(
        "Microphone error. Please check microphone permission.",
        "assistant"
      );
    };

    recognition.onend = () => {
      setStatus("ONLINE");
    };

    recognition.start();
  });
}

// ---------- CAMERA / IMAGE ----------
if (cam && imgInput) {
  cam.addEventListener("click", () => {
    imgInput.click();
  });
}

if (imgInput) {
  imgInput.addEventListener("change", async event => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addMessage("Please select an image.", "assistant");
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];

      const imageData = {
        mimeType: file.type,
        data: base64
      };

      const question =
        msg.value.trim() ||
        "Describe this image.";

      await sendMessage(question, imageData);
    };

    reader.readAsDataURL(file);

    imgInput.value = "";
  });
}

// ---------- CLEAR CHAT ----------
if (clear) {
  clear.addEventListener("click", () => {
    history = [];
    localStorage.removeItem("jarvis_history");

    chat.innerHTML = "";

    setStatus("ONLINE");

    addMessage(
      "Chat cleared. Your saved memories are preserved.",
      "assistant"
    );
  });
}

// ---------- RESTORE CHAT ----------
history.forEach(item => {
  addMessage(
    item.text,
    item.role === "user" ? "user" : "assistant"
  );
});

// ---------- START ----------
setStatus("ONLINE");

console.log("JARVIS FAST AI READY");
