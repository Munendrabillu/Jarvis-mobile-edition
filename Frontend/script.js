
const $ = id => document.getElementById(id);

const chatBox = $('chat-box');
const userInput = $('user-input');
const statusText = $('status');
const orb = $('jarvis-orb');

let apiKey = localStorage.getItem('jarvis_key') || '';
let language = localStorage.getItem('jarvis_language') || 'both';
let voiceEnabled = localStorage.getItem('jarvis_voice') !== 'false';

let conversations = JSON.parse(
  localStorage.getItem('jarvis_chats') || '[]'
);

let activeChatId = null;
let selectedImage = null;
let recognition = null;
let listening = false;

function createChat() {
  const chat = {
    id: Date.now().toString(),
    title: 'New Conversation',
    messages: []
  };

  conversations.unshift(chat);
  activeChatId = chat.id;
  saveChats();
  renderChat();
  renderHistory();
}

function getChat() {
  return conversations.find(c => c.id === activeChatId);
}

function saveChats() {
  localStorage.setItem('jarvis_chats', JSON.stringify(conversations));
}

function renderChat() {
  chatBox.innerHTML = '';

  const chat = getChat();

  if (!chat || !chat.messages.length) {
    chatBox.innerHTML = `
      <div class="welcome">
        <h2>How can I help you?</h2>
        <p>Your personal AI assistant is ready.</p>
      </div>`;
    return;
  }

  chat.messages.forEach(message => {
    const div = document.createElement('div');
    div.className = `message ${message.role}`;
    div.textContent = message.text;
    chatBox.appendChild(div);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

function renderHistory() {
  const list = $('history-list');
  list.innerHTML = '';

  conversations.forEach(chat => {
    const btn = document.createElement('button');
    btn.className = 'history-item';
    btn.textContent = chat.title;

    btn.addEventListener('click', () => {
      activeChatId = chat.id;
      renderChat();
      $('sidebar').classList.remove('open');
    });

    list.appendChild(btn);
  });
}

function addMessage(role, text) {
  const chat = getChat();
  if (!chat) return;

  chat.messages.push({ role, text });

  if (role === 'user' && chat.title === 'New Conversation') {
    chat.title = text.slice(0, 35);
  }

  saveChats();
  renderChat();
  renderHistory();
}

function setStatus(text, state = '') {
  statusText.textContent = text;
  orb.classList.toggle('active', state === 'active');
}

function getLanguageInstruction() {
  if (language === 'te') {
    return 'Always respond in natural Telugu.';
  }

  if (language === 'en') {
    return 'Always respond in English.';
  }

  return 'Respond naturally in English and Telugu, according to the user’s language and preference.';
}

async function callGemini(messages, image = null) {
  if (!apiKey) {
    throw new Error('Please enter your Gemini API key in Settings.');
  }

  const contents = [];

  messages.forEach(message => {
    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.text }]
    });
  });

  if (image) {
    const base64 = await fileToBase64(image);
    const mime = image.type;

    contents.push({
      role: 'user',
      parts: [
        { text: 'Analyze this image and explain what you see.' },
        {
          inline_data: {
            mime_type: mime,
            data: base64.split(',')[1]
          }
        }
      ]
    });
  }

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text:
              'You are J.A.R.V.I.S, a helpful personal AI assistant. ' +
              getLanguageInstruction()
          }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Gemini API request failed.');
  }

  const answer = data.candidates?.[0]?.content?.parts
    ?.map(p => p.text || '')
    .join('');

  if (!answer) {
    throw new Error('Gemini returned an empty response.');
  }

  return answer;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function askJarvis() {
  const text = userInput.value.trim();

  if (!text && !selectedImage) return;

  if (!getChat()) createChat();

  const chatId = activeChatId;
  const chat = getChat();

  if (text) {
    addMessage('user', text);
  }

  const image = selectedImage;
  selectedImage = null;
  $('image-preview').innerHTML = '';

  userInput.value = '';
  setStatus('JARVIS is thinking...', 'active');

  try {
    const currentChat = conversations.find(c => c.id === chatId);
    const messages = currentChat.messages.map(m => ({
      role: m.role,
      text: m.text
    }));

    const answer = await callGemini(messages, image);

    const targetChat = conversations.find(c => c.id === chatId);

    if (!targetChat) return;

    targetChat.messages.push({
      role: 'assistant',
      text: answer
    });

    saveChats();

    if (activeChatId === chatId) {
      renderChat();
    }

    if (voiceEnabled) speak(answer);

    setStatus('J.A.R.V.I.S systems online.');
  } catch (error) {
    console.error(error);

    const targetChat = conversations.find(c => c.id === chatId);

    if (targetChat) {
      targetChat.messages.push({
        role: 'assistant',
        text: 'Error: ' + error.message
      });

      saveChats();

      if (activeChatId === chatId) renderChat();
    }

    setStatus('System error. Please try again.');
  }
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'te' ? 'te-IN' : 'en-IN';
  utterance.rate = 1;

  speechSynthesis.speak(utterance);
}

function initVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert('Speech recognition is not supported in this browser.');
    return;
  }

  if (listening && recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = language === 'te' ? 'te-IN' : 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    listening = true;
    setStatus('Listening...');
  };

  recognition.onresult = event => {
    let transcript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }

    userInput.value = transcript;
  };

  recognition.onend = () => {
    listening = false;
    setStatus('J.A.R.V.I.S systems online.');
  };

  recognition.onerror = event => {
    listening = false;
    setStatus('Voice error: ' + event.error);
  };

  recognition.start();
}

$('send').addEventListener('click', askJarvis);

userInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    askJarvis();
  }
});

$('mic-btn').addEventListener('click', initVoice);

$('cam-btn').addEventListener('click', () => {
  $('img-input').click();
});

$('img-input').addEventListener('change', async event => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select an image.');
    event.target.value = '';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('Image must be smaller than 10 MB.');
    event.target.value = '';
    return;
  }

  selectedImage = file;

  const preview = $('image-preview');
  preview.innerHTML = '';

  const img = document.createElement('img');
  img.src = await fileToBase64(file);
  img.alt = 'Selected image';

  preview.appendChild(img);
});

$('clear-btn').addEventListener('click', () => {
  if (!confirm('Clear this conversation?')) return;

  const chat = getChat();

  if (chat) {
    chat.messages = [];
    chat.title = 'New Conversation';
  }

  saveChats();
  renderChat();
  renderHistory();
});

$('new-chat-btn').addEventListener('click', createChat);

$('menu-btn').addEventListener('click', () => {
  $('sidebar').classList.toggle('open');
});

$('theme-btn').addEventListener('click', () => {
  document.body.classList.toggle('light');

  localStorage.setItem(
    'jarvis_theme',
    document.body.classList.contains('light') ? 'light' : 'dark'
  );
});

$('settings-btn').addEventListener('click', () => {
  $('api-key').value = apiKey;
  $('language').value = language;
  $('voice-toggle').checked = voiceEnabled;
  $('settings-dialog').showModal();
});

$('close-settings').addEventListener('click', () => {
  $('settings-dialog').close();
});

$('save-settings').addEventListener('click', () => {
  apiKey = $('api-key').value.trim();
  language = $('language').value;
  voiceEnabled = $('voice-toggle').checked;

  localStorage.setItem('jarvis_key', apiKey);
  localStorage.setItem('jarvis_language', language);
  localStorage.setItem('jarvis_voice', voiceEnabled);

  $('settings-dialog').close();
});

function initialize() {
  const savedTheme = localStorage.getItem('jarvis_theme');

  if (savedTheme === 'light') {
    document.body.classList.add('light');
  }

  if (conversations.length) {
    activeChatId = conversations[0].id;
  } else {
    createChat();
  }

  renderChat();
  renderHistory();
}

initialize();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(error => console.error('Service worker error:', error));
  });
}
