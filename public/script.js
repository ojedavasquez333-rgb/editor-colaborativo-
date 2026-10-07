const socket = io();

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

// Cuando recibimos nuestra info, nos unimos a la sala
socket.on('my-info', (info) => {
    myInfo = info;
    socket.emit('join-room', roomId);
});

// ------------- ENVIAR MENSAJES -------------
const sendMessage = () => {
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('chat-message', { roomId, content: text });
        messageInput.value = ''; // Limpiar el campo
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
    const isMe = myInfo && myInfo.id === msg.senderId;
    
    // Crear contenedor del mensaje (burbuja)
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMe ? 'message-own' : 'message-other'}`;
    
    // Nombre del remitente
    const nameSpan = document.createElement('div');
    nameSpan.className = 'message-name';
    // Letra verde (WP) si somos nosotros, sino el color asignado
    nameSpan.style.color = isMe ? '#00a884' : msg.senderColor;
    nameSpan.innerText = isMe ? `Tú (${msg.senderName})` : msg.senderName;
    
    // Texto del mensaje
    const textSpan = document.createElement('div');
    textSpan.className = 'message-text';
    textSpan.innerText = msg.text;
    
    // Hora
    const timeSpan = document.createElement('div');
    timeSpan.className = 'message-time';
    timeSpan.innerText = msg.timestamp;
    
    messageDiv.appendChild(nameSpan);
    messageDiv.appendChild(textSpan);
    messageDiv.appendChild(timeSpan);
    
    messagesListEl.appendChild(messageDiv);
    
    // Hacer auto-scroll hacia abajo inmediatamente
    chatContainerEl.scrollTop = chatContainerEl.scrollHeight;
};

// Recibir todo el historial cuando entramos a la sala
socket.on('chat-history', (history) => {
    messagesListEl.innerHTML = '';
    history.forEach(renderMessage);
});

// Recibir un nuevo mensaje en vivo
socket.on('new-message', (msg) => {
    renderMessage(msg);
});


// ------------- USUARIOS Y EVENTOS -------------
socket.on('room-users', (users) => {
    usersListEl.innerHTML = ''; 
    users.forEach(user => {
        const isMe = myInfo && myInfo.id === user.id;
        
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
    typingIndicatorEl.innerText = `${data.name} está escribiendo...`;
    typingIndicatorEl.style.color = data.color;
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        typingIndicatorEl.innerText = '';
    }, 1500);
});
