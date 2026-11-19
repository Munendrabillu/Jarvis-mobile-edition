

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const form = document.getElementById('chatForm');

// Check whether required HTML elements exist
if (!chat || !input || !form) {
    console.error('J.A.R.V.I.S: Required HTML elements not found.');
} else {

    // Handle message submission
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const message = input.value.trim();

        if (!message) return;

        // Display user message
        addMessage('YOU: ' + message, 'user');

        // Clear input
        input.value = '';

        // Display AI processing message
        const processingMessage = addMessage(
            'J.A.R.V.I.S: Processing...',
            'ai'
        );

        // Simulate AI response
        setTimeout(() => {
            processingMessage.innerText =
                'J.A.R.V.I.S: Systems online. How may I assist you, Boss?';

            chat.scrollTop = chat.scrollHeight;

        }, 1000);

        // Return focus to input
        input.focus();
    });

}

// Function to add messages
function addMessage(text, who) {

    const message = document.createElement('div');

    message.className = 'msg ' + who;
    message.innerText = text;

    chat.appendChild(message);

    chat.scrollTop = chat.scrollHeight;

    return message;
}
