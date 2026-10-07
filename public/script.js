// Obtener o generar un ID único de dispositivo en localStorage para persistencia de identidad
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('deviceId', deviceId);
}

// Conectar enviando el deviceId de autenticación
const socket = io({
    auth: {
        deviceId: deviceId
    }
});

const getRoomId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    if (!roomId) {
        roomId = 'general';
        window.history.pushState({}, '', `?room=${roomId}`);
    }
    return roomId;
};

const roomId = getRoomId();
const messagesListEl = document.getElementById('messages-list');
const chatContainerEl = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usersListEl = document.getElementById('users-list');
const typingIndicatorEl = document.getElementById('typing-indicator');

let myInfo = null;

// Recibir nuestra identidad confirmada
socket.on('my-info', (info) => {
    myInfo = info;
    socket.emit('join-room', roomId);
});

// ------------- ENVIAR MENSAJES -------------
const sendMessage = () => {
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('chat-message', { roomId, content: text });
        messageInput.value = '';
    }
};

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Emitir evento de 'está escribiendo'
let typingTimeout;
messageInput.addEventListener('input', () => {
    socket.emit('typing', { roomId });
});

// ------------- RENDERIZAR MENSAJES -------------
const renderMessage = (msg) => {
    const isMe = myInfo && myInfo.deviceId === msg.senderDeviceId;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMe ? 'message-own' : 'message-other'}`;
    
    const nameSpan = document.createElement('div');
    nameSpan.className = 'message-name';
    nameSpan.style.color = isMe ? '#00c288' : msg.senderColor; // Color distintivo claro para nosotros
    nameSpan.innerText = isMe ? `Tú (${msg.senderName})` : msg.senderName;
    
    const textSpan = document.createElement('div');
    textSpan.className = 'message-text';
    textSpan.innerText = msg.text;
    
    const timeSpan = document.createElement('div');
    timeSpan.className = 'message-time';
    timeSpan.innerText = msg.timestamp;
    
    messageDiv.appendChild(nameSpan);
    messageDiv.appendChild(textSpan);
    messageDiv.appendChild(timeSpan);
    
    messagesListEl.appendChild(messageDiv);
    chatContainerEl.scrollTop = chatContainerEl.scrollHeight;
};

socket.on('chat-history', (history) => {
    messagesListEl.innerHTML = '';
    history.forEach(renderMessage);
});

socket.on('new-message', (msg) => {
    renderMessage(msg);
});

// ------------- USUARIOS Y EVENTOS -------------
socket.on('room-users', (users) => {
    usersListEl.innerHTML = ''; 
    users.forEach(user => {
        const isMe = myInfo && myInfo.deviceId === user.deviceId;
        
        const badge = document.createElement('div');
        badge.className = 'user-badge';
        
        const dot = document.createElement('div');
        dot.className = 'user-dot';
        dot.style.backgroundColor = user.color;
        
        const text = document.createElement('span');
        text.innerText = user.name + (isMe ? ' (Tú)' : '');
        text.style.color = user.color;
        
        badge.appendChild(dot);
        badge.appendChild(text);
        usersListEl.appendChild(badge);
    });
});

socket.on('user-typing', (data) => {
    // Si somos nosotros mismos los que escribimos (desde otra pestaña del mismo deviceId), ignorar
    if (myInfo && data.deviceId === myInfo.deviceId) return;
    
    typingIndicatorEl.innerText = `${data.name} está escribiendo...`;
    typingIndicatorEl.style.color = data.color;
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        typingIndicatorEl.innerText = '';
    }, 1500);
});
