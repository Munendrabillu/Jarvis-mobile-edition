
(() => {
  "use strict";

  const API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/";

  // Models are attempted in order
  const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash"
  ];

  let apiKey = localStorage.getItem("jarvis_key") || "";
  let history = [];

  try {
    history = JSON.parse(localStorage.getItem("jarvis_memory") || "[]");
  } catch {
    history = [];
  }

  const box = document.getElementById("chat-messages");
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const clearBtn = document.getElementById("clear-chat");

  const aiStatus = document.getElementById("ai-status");
  const voiceStatus = document.getElementById("voice-status");
  const memoryStatus = document.getElementById("memory-status");

  let busy = false;

  if (!apiKey) {
    apiKey = prompt("Enter your Gemini API key:");

    if (apiKey) {
      localStorage.setItem("jarvis_key", apiKey);
    }
  }

  // Save chat history
  function persist() {
    localStorage.setItem("jarvis_memory", JSON.stringify(history));
  }

  // Create chat messages
  function addMessage(role, text, kind = "") {
    const el = document.createElement("div");

    el.className =
      "msg " +
      (role === "user" ? "user" : "assistant") +
      (kind ? " " + kind : "");

    const label = document.createElement("span");
    label.className = "sender";
    label.textContent = role === "user" ? "YOU" : "J.A.R.V.I.S.";

    const content = document.createElement("div");
    content.className = "message-text";
    content.textContent = text;

    el.append(label, content);
    box.appendChild(el);

    box.scrollTop = box.scrollHeight;

    return el;
  }

  // Display previous messages
  function render() {
    box.innerHTML = "";

    if (history.length === 0) {
      addMessage(
        "assistant",
        "Systems online. How may I assist you, Boss?"
      );
    }

    history.forEach(message => {
      addMessage(
        message.role === "user" ? "user" : "assistant",
        message.text
      );
    });
  }

  // Send request to Gemini
  async function callModel(model) {
    const url =
      API_URL +
      model +
      ":generateContent?key=" +
      encodeURIComponent(apiKey);

    const contents = history.map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.text }]
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data?.error?.message || "HTTP " + response.status
      );

      error.status = response.status;
      throw error;
    }

    return (
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "No response received."
    );
  }

  // Try alternate models
  async function getReply() {
    let lastError;

    for (const model of MODELS) {
      try {
        return await callModel(model);
      } catch (error) {
        lastError = error;

        if (error.status !== 404 && error.status !== 400) {
          throw error;
        }
      }
    }

    throw new Error(
      "All Gemini models failed. Check your API key and model access. " +
      (lastError?.message || "")
    );
  }

  // AI response
  async function send() {
    const text = input.value.trim();

    if (!text || busy) return;

    if (!apiKey) {
      addMessage("assistant", "API key missing.", "error");
      return;
    }

    busy = true;
    sendBtn.disabled = true;

    input.value = "";

    addMessage("user", text);

    history.push({
      role: "user",
      text: text
    });

    persist();

    const pending = addMessage(
      "assistant",
      "Establishing neural connection..."
    );

    if (aiStatus) {
      aiStatus.textContent = "PROCESSING";
    }

    try {
      const reply = await getReply();

      pending.remove();

      addMessage("assistant", reply);

      history.push({
        role: "assistant",
        text: reply
      });

      persist();

      speak(reply);

      if (aiStatus) {
        aiStatus.textContent = "ONLINE";
      }
    } catch (error) {
      pending.remove();

      addMessage(
        "assistant",
        "CONNECTION ERROR: " + error.message,
        "error"
      );

      if (aiStatus) {
        aiStatus.textContent = "ERROR";
      }
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // Voice output
  function speak(text) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 0.9;

    window.speechSynthesis.speak(utterance);
  }

  // Voice recognition
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  let recognition = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      if (voiceStatus) {
        voiceStatus.textContent = "LISTENING";
        voiceStatus.className = "green";
      }

      micBtn.classList.add("listening");
    };

    recognition.onresult = event => {
      input.value = event.results[0][0].transcript;
      send();
    };

    recognition.onerror = event => {
      if (voiceStatus) {
        voiceStatus.textContent = "VOICE ERROR";
        voiceStatus.className = "amber";
      }

      addMessage(
        "assistant",
        "Voice recognition error: " + event.error,
        "error"
      );
    };

    recognition.onend = () => {
      if (voiceStatus) {
        voiceStatus.textContent = "READY";
        voiceStatus.className = "";
      }

      micBtn.classList.remove("listening");
    };
  }

  // Mic button
  micBtn.addEventListener("click", () => {
    if (!recognition) {
      addMessage(
        "assistant",
        "Voice recognition is not supported in this browser.",
        "error"
      );
      return;
    }

    try {
      recognition.start();
    } catch {
      addMessage("assistant", "Microphone is already active.");
    }
  });

  // Send button
  sendBtn.addEventListener("click", send);

  // Enter to send
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });

  // Clear chat
  clearBtn.addEventListener("click", () => {
    history = [];

    localStorage.removeItem("jarvis_memory");

    render();
  });

  // Initial system status
  if (memoryStatus) {
    memoryStatus.textContent = "LOCAL MEMORY";
  }

  render();

})();
