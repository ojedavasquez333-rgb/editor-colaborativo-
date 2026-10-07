let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('deviceId', deviceId);
}

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
    nameSpan.style.color = isMe ? '#ffffff' : msg.senderColor; 
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

// Recibir orden de borrar historial en tiempo real
socket.on('chat-cleared', () => {
    messagesListEl.innerHTML = '';
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
    if (myInfo && data.deviceId === myInfo.deviceId) return;
    
    typingIndicatorEl.innerText = `${data.name} está escribiendo...`;
    typingIndicatorEl.style.color = data.color;
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        typingIndicatorEl.innerText = '';
    }, 1500);
});

// ------------- ADMIN MODALS -------------
const adminIcon = document.getElementById('admin-icon');
const passwordModal = document.getElementById('password-modal');
const configModal = document.getElementById('config-modal');
const passInput = document.getElementById('admin-password');
const passError = document.getElementById('password-error');

// Mostrar modal de contraseña
adminIcon.addEventListener('click', () => {
    passwordModal.classList.add('active');
    passInput.focus();
});

// Cancelar contraseña
document.getElementById('cancel-password').addEventListener('click', () => {
    passwordModal.classList.remove('active');
    passInput.value = '';
    passError.style.display = 'none';
});

// Validar contraseña
const submitPassword = () => {
    if (passInput.value === '27') {
        passwordModal.classList.remove('active');
        passInput.value = '';
        passError.style.display = 'none';
        
        // Abrir panel de configuración
        configModal.classList.add('active');
    } else {
        // Acceso denegado
        passError.style.display = 'block';
    }
};

document.getElementById('submit-password').addEventListener('click', submitPassword);
passInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitPassword();
});

// Cerrar config
document.getElementById('close-config').addEventListener('click', () => {
    configModal.classList.remove('active');
});

// Borrar chat
document.getElementById('clear-chat-btn').addEventListener('click', () => {
    const confirmClear = confirm("¿ESTÁS SEGURO? Esta acción vaciará permanentemente el chat para todos los conectados.");
    if (confirmClear) {
        // Enviar evento de clear validado al backend
        socket.emit('clear-chat', { roomId, password: '27' });
        configModal.classList.remove('active');
    }
});
