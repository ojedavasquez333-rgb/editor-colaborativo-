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

// Lógica del Splash Screen
const splashScreen = document.getElementById('splash-screen');
const hideSplash = () => {
    if (!splashScreen) return;
    splashScreen.style.opacity = '0';
    setTimeout(() => {
        splashScreen.style.display = 'none';
    }, 300); // Esperar a que termine la transición CSS
};

// Ocultar si conecta rápido (con pequeño delay visual para el pulso), o máximo 600ms
let splashTimeout = setTimeout(hideSplash, 600);
socket.on('connect', () => {
    setTimeout(hideSplash, 200);
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
let currentUsers = [];
socket.on('room-users', (users) => {
    currentUsers = users;
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
    populateKickList();
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
const adminBtn = document.getElementById('admin-btn');
const passwordModal = document.getElementById('password-modal');
const configModal = document.getElementById('config-modal');
const passInput = document.getElementById('admin-password');
const passError = document.getElementById('password-error');
const toggleLockBtn = document.getElementById('toggle-lock-btn');

let roomIsLocked = false;
let hasAdminAccess = false;

function updateInputState() {
    if (roomIsLocked && !hasAdminAccess) {
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = "El chat ha sido bloqueado temporalmente por el administrador";
    } else {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.placeholder = (roomIsLocked && hasAdminAccess) ? "Escribe un mensaje... (Modo Admin)" : "Escribe un mensaje...";
    }
}

socket.on('room-lock-changed', (locked) => {
    roomIsLocked = locked;
    if (toggleLockBtn) toggleLockBtn.innerText = locked ? "Desbloquear sala" : "Bloquear acceso / Desbloquear sala";
    updateInputState();
});

socket.on('kicked', () => {
    document.getElementById('banned-modal').classList.add('active');
});

socket.on('room-locked-error', () => {
    document.getElementById('locked-entry-modal').classList.add('active');
});

// Mostrar modal de contraseña
adminBtn.addEventListener('click', () => {
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
        hasAdminAccess = true;
        updateInputState();
        passwordModal.classList.remove('active');
        passInput.value = '';
        passError.style.display = 'none';
        
        // Abrir panel de configuración
        configModal.classList.add('active');
        populateKickList();
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
        socket.emit('clear-chat', { roomId, password: '27' });
        configModal.classList.remove('active');
    }
});

// Bloquear / Desbloquear sala
if (toggleLockBtn) {
    toggleLockBtn.addEventListener('click', () => {
        socket.emit('toggle-lock', { roomId, password: '27' });
    });
}

// Poblar lista de expulsión
function populateKickList() {
    const kickListContainer = document.getElementById('kick-list');
    if (!kickListContainer) return;
    kickListContainer.innerHTML = '';
    
    if (!myInfo) return;
    
    const others = currentUsers.filter(u => u.deviceId !== myInfo.deviceId);
    if (others.length === 0) {
        kickListContainer.innerHTML = '<span style="color: #666; font-size: 13px;">No hay otros participantes conectados.</span>';
        return;
    }
    
    others.forEach(u => {
        const item = document.createElement('div');
        item.className = 'kick-item';
        item.innerHTML = `
            <span class="kick-item-name" style="color: ${u.color}">${u.name}</span>
            <button class="kick-btn" onclick="kickUser('${u.deviceId}')">Expulsar</button>
        `;
        kickListContainer.appendChild(item);
    });
}

window.kickUser = function(targetDeviceId) {
    if(confirm('¿Seguro que quieres expulsar a este usuario?')) {
        socket.emit('kick-user', { roomId, targetDeviceId, password: '27' });
    }
};
