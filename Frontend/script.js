(() => {
  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
  let API_KEY = localStorage.getItem("jarvis_key") || "";
  let chatHistory = JSON.parse(localStorage.getItem("jarvis_memory") || "[]");

  const chatBox = document.getElementById("chat-messages");
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const clearBtn = document.getElementById("clear-chat");
  const languageSelect = document.getElementById("language");

  if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");
    if (API_KEY) {
      localStorage.setItem("jarvis_key", API_KEY);
    }
  }

  function addMessage(sender, text) {
    const div = document.createElement("div");
    div.className = "message " + sender;
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function saveMemory() {
    localStorage.setItem("jarvis_memory", JSON.stringify(chatHistory));
  }

  function restoreChat() {
    chatHistory.forEach(msg => {
      addMessage(msg.role === "user" ? "user" : "assistant", msg.text);
    });
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    if (!API_KEY) {
      addMessage("assistant", "API key is missing.");
      return;
    }

    input.value = "";
    addMessage("user", text);

    chatHistory.push({ role: "user", text });
    saveMemory();

    sendBtn.disabled = true;

    const typing = document.createElement("div");
    typing.className = "message assistant";
    typing.textContent = "J.A.R.V.I.S. is thinking...";
    chatBox.appendChild(typing);

    try {
      const model = "gemini-2.5-flash";

      const response = await fetch(
        `${API_URL}${model}:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: chatHistory.map(msg => ({
              role: msg.role === "assistant" ? "model" : "user",
              parts: [{ text: msg.text }]
            }))
          })
        }
      );

      if (!response.ok) {
        throw new Error("Gemini API error: " + response.status);
      }

      const data = await response.json();

      const reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I couldn't generate a response.";

      typing.remove();
      addMessage("assistant", reply);

      chatHistory.push({ role: "assistant", text: reply });
      saveMemory();

      speak(reply);
    } catch (error) {
      typing.remove();
      addMessage("assistant", "Error: " + error.message);
    } finally {
      sendBtn.disabled = false;
    }
  }

  // Voice output
  function speak(text) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    const selectedLanguage = languageSelect?.value || "auto";

    if (selectedLanguage === "te-IN") {
      utterance.lang = "te-IN";
    } else if (selectedLanguage === "en-IN") {
      utterance.lang = "en-IN";
    } else {
      utterance.lang = "en-US";
    }

    window.speechSynthesis.speak(utterance);
  }

  // Voice input
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      sendMessage();
    };

    recognition.onerror = () => {
      addMessage("assistant", "Voice recognition error.");
    };

    recognition.onend = () => {
      micBtn.classList.remove("listening");
    };
  }

  function startListening() {
    if (!recognition) {
      addMessage("assistant", "Voice recognition is not supported.");
      return;
    }

    const selectedLanguage = languageSelect?.value || "auto";

    recognition.lang =
      selectedLanguage === "te-IN"
        ? "te-IN"
        : selectedLanguage === "en-IN"
        ? "en-IN"
        : "en-US";

    recognition.start();
    micBtn.classList.add("listening");
  }

  // Event listeners
  sendBtn.addEventListener("click", sendMessage);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      sendMessage();
    }
  });

  micBtn.addEventListener("click", startListening);

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      chatHistory = [];
      localStorage.removeItem("jarvis_memory");
      chatBox.innerHTML = "";
    });
  }

  restoreChat();
})();
