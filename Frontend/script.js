const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const form = document.getElementById('chat-form');

function addMessage(label, message, type) {
  const item = document.createElement('div');
  item.className = `msg ${type}`;

  const speaker = document.createElement('span');
  speaker.className = 'speaker';
  speaker.textContent = label;

  const text = document.createElement('p');
  text.textContent = message;

  item.append(speaker, text);
  chat.appendChild(item);
  chat.scrollTop = chat.scrollHeight;
  return item;
}

function getDemoReply(message) {
  const command = message.toLowerCase();

  if (/\b(hello|hi|hey)\b/.test(command)) {
    return 'Hello, Boss. All systems are ready. What would you like me to do?';
  }
  if (command.includes('your name') || command.includes('who are you')) {
    return 'I am J.A.R.V.I.S., your personal assistant interface.';
  }
  if (command.includes('time')) {
    return `The current device time is ${new Date().toLocaleTimeString()}.`;
  }
  if (command.includes('date')) {
    return `Today is ${new Date().toLocaleDateString()}.`;
  }
  if (command.includes('status')) {
    return 'The interface is online. Voice and AI services are not connected yet.';
  }
  if (command.includes('help')) {
    return 'Try saying hello, asking for the time, asking for the date, or checking system status.';
  }
  return 'Command received, Boss. This is the local demo interface; connect an AI backend to enable intelligent answers.';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  addMessage('YOU', message, 'user');
  input.value = '';
  const reply = addMessage('J.A.R.V.I.S.', 'Processing...', 'ai');

  window.setTimeout(() => {
    reply.querySelector('p').textContent = getDemoReply(message);
    chat.scrollTop = chat.scrollHeight;
  }, 500);
});
