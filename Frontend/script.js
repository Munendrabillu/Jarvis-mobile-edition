// =============== JARVIS AI ===============
// Gemini 3.8 Flash
// Instant personal memory + chat + mic + camera

const $ = id => document.getElementById(id);

const chat = $("chat");
const msg = $("msg");
const send = $("send");
const mic = $("mic-btn");
const cam = $("cam-btn");
const clear = $("clear-btn");
const imgInput = $("img-input");
const coreText = $("core-text");

// =============== API KEY ===============
let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API Key:");

  if (API_KEY) {
    API_KEY = API_KEY.trim();
    localStorage.setItem("jarvis_key", API_KEY);
  }
}

// =============== MODEL ===============
const MODEL = "gemini-3.8-flash";

// =============== MEMORY ===============
let memory = {};

try {
  memory = JSON.parse(
    localStorage.getItem("jarvis_memory") || "{}"
  );
} catch {
  memory = {};
}

function saveMemory() {
  localStorage.setItem(
    "jarvis_memory",
    JSON.stringify(memory)
  );
}

// =============== CHAT HISTORY ===============
let history = [];

try {
  history = JSON.parse(
    localStorage.getItem("jarvis_history") || "[]"
  );
} catch {
  history = [];
}

function saveHistory() {
  history = history.slice(-12);

  localStorage.setItem(
    "jarvis_history",
    JSON.stringify(history)
  );
}

// =============== STATUS ===============
function setStatus(text) {
  if (coreText) {
    coreText.textContent = text;
  }
}

// =============== DISPLAY ===============
function addMessage(text, sender) {
  const div = document.createElement("div");

  div.className = sender;
  div.textContent = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;

  return div;
}

// =============== MEMORY STORAGE ===============
function storeFact(text) {
  let m;

  m = text.match(
    /my favou?rite colou?r is\s+(.+)/i
  );

  if (m) {
    memory.favourite_colour =
      m[1].trim().replace(/[.!?]+$/, "");

    saveMemory();

    return "I will remember that your favourite colour is " +
      memory.favourite_colour + ".";
  }

  m = text.match(
    /my favou?rite food is\s+(.+)/i
  );

  if (m) {
    memory.favourite_food =
      m[1].trim().replace(/[.!?]+$/, "");

    saveMemory();

    return "I will remember that your favourite food is " +
      memory.favourite_food + ".";
  }

  m = text.match(
    /my favou?rite movie is\s+(.+)/i
  );

  if (m) {
    memory.favourite_movie =
      m[1].trim().replace(/[.!?]+$/, "");

    saveMemory();

    return "I will remember that your favourite movie is " +
      memory.favourite_movie + ".";
  }

  m = text.match(
    /my name is\s+(.+)/i
  );

  if (m) {
    memory.user_name =
      m[1].trim().replace(/[.!?]+$/, "");

    saveMemory();

    return "I will remember your name.";
  }

  return null;
}

// =============== MEMORY RECALL ===============
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

  if (
    t.includes("favourite food") ||
    t.includes("favorite food")
  ) {
    if (memory.favourite_food) {
      return "Your favourite food is " +
        memory.favourite_food + ".";
    }
  }

  if (
    t.includes("favourite movie") ||
    t.includes("favorite movie")
  ) {
    if (memory.favourite_movie) {
      return "Your favourite movie is " +
        memory.favourite_movie + ".";
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

// =============== LOCAL TOOLS ===============
async function handleTools(text) {
  const t = text.toLowerCase().trim();

  // TIME
  if (/\btime\b/.test(t)) {
    return "The time is " +
      new Date().toLocaleTimeString();
  }

  // DATE
  if (
    t.includes("today's date") ||
    t.includes("what date is it") ||
    t === "date"
  ) {
    return "Today is " +
      new Date().toLocaleDateString();
  }

  // GOOGLE SEARCH
  if (
    t.startsWith("search ") ||
    t.startsWith("google ")
  ) {
    const q = text.replace(/^(search|google)\s+/i, "");

    window.open(
      "https://www.google.com/search?q=" +
      encodeURIComponent(q),
      "_blank"
    );

    return "Searching Google for " + q;
  }

  // YOUTUBE
  if (t.startsWith("youtube ")) {
    const q = text.replace(/^youtube\s+/i, "");

    window.open(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(q),
      "_blank"
    );

    return "Searching YouTube for " + q;
  }

  // WIKIPEDIA
  if (t.startsWith("wiki ")) {
    const q = text.replace(/^wiki\s+/i, "");

    window.open(
      "https://en.wikipedia.org/wiki/Special:Search?search=" +
      encodeURIComponent(q),
      "_blank"
    );

    return "Searching Wikipedia for " + q;
  }

  // CALCULATOR
  if (t.startsWith("calculate ")) {
    const expression = text.replace(
      /^calculate\s+/i, ""
    );

    if (/^[0-9+\-*/().%\s]+$/.test(expression)) {
      try {
        const result = Function(
          '"use strict";return (' +
          expression + ')'
        )();

        if (Number.isFinite(result)) {
          return "Answer: " + result;
        }
      } catch {
        return "Invalid calculation.";
      }
    }

    return "Please enter a valid calculation.";
  }

  return null;
}

// =============== GEMINI 3.8 ===============
async function askGemini(question, imageData = null) {
  if (!API_KEY) {
    return "API key missing. Reload and enter your API key.";
  }

  const contents = history.slice(-8).map(item => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));

  const parts = [{
    text:
      "You are JARVIS, a smart, fast personal AI assistant. " +
      "Answer naturally and accurately, with concise answers. " +
      "Remember and use the following personal memory: " +
      JSON.stringify(memory) +
      ". User says: " + question
  }];

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

  try {
    setStatus("CONNECTING");

    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      25000
    );

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      MODEL +
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
            maxOutputTokens: 512
          }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      const err = data.error?.message ||
        "Gemini API request failed.";

      return "Gemini error (" +
        response.status + "): " + err;
    }

    const answer =
      data.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("")
        .trim();

    if (!answer) {
      return "Gemini returned an empty response. Please try again.";
    }

    return answer;

  } catch (error) {
    if (error.name === "AbortError") {
      return "Gemini took too long to respond. Please try again.";
    }

    return "Connection failed: " + error.message;
  }
}

// =============== SPEECH ===============
function speak(text) {
  if (!window.speechSynthesis) return;

  speechSynthesis.cancel();

  const speech = new SpeechSynthesisUtterance(text);

  speech.rate = 1.05;
  speech.pitch = 1;

  speechSynthesis.speak(speech);
}

// =============== MAIN ===============
async function sendMessage(text, imageData = null) {
  text = (text || "").trim();

  if (!text && !imageData) return;

  if (text) {
    addMessage(text, "user");
  }

  msg.value = "";

  setStatus("THINKING");

  try {
    let answer = null;

    // Save personal fact
    if (text) {
      answer = storeFact(text);
    }

    // Recall memory instantly
    if (!answer && text) {
      answer = recallFact(text);
    }

    // Local tools
    if (!answer && text) {
      answer = await handleTools(text);
    }

    // Gemini
    if (!answer) {
      answer = await askGemini(text, imageData);
    }

    addMessage(answer, "assistant");

    // Store only ordinary conversations
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
  }

  setStatus("ONLINE");
}

// =============== SEND BUTTON ===============
if (send) {
  send.addEventListener("click", () => {
    sendMessage(msg.value);
  });
}

// =============== ENTER KEY ===============
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
    const SR =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SR) {
      addMessage(
        "Speech recognition is not supported here.",
        "assistant"
      );
      return;
    }

    const recognition = new SR();

    recognition.lang = "en-IN";
    recognition.continuous = false;

    recognition.onstart = () => {
      setStatus("LISTENING");
    };

    recognition.onresult = event => {
      const speech =
        event.results[0][0].transcript;

      msg.value = speech;
      sendMessage(speech);
    };

    recognition.onerror = () => {
      addMessage(
        "Microphone error. Check browser permission.",
        "assistant"
      );
    };

    recognition.onend = () => {
      setStatus("ONLINE");
    };

    recognition.start();
  });
}

// =============== CAMERA ===============
if (cam && imgInput) {
  cam.addEventListener("click", () => {
    imgInput.click();
  });
}

if (imgInput) {
  imgInput.addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addMessage(
        "Please select an image file.",
        "assistant"
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const data = reader.result.split(",");

      const imageData = {
        mimeType: file.type,
        data: data[1]
      };

      const question =
        msg.value.trim() ||
        "Describe this image.";

      sendMessage(question, imageData);
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

    chat.innerHTML = "";

    addMessage(
      "Chat cleared. My saved memories remain.",
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

// =============== READY ===============
setStatus("ONLINE");

console.log("JARVIS GEMINI 3.8 READY");
