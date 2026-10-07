const socket = io();

// Función para obtener el ID de la sala desde la URL o usar una sala global por defecto
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
const editor = document.getElementById('editor');
const usersListEl = document.getElementById('users-list');
const typingIndicatorEl = document.getElementById('typing-indicator');

let myInfo = null;

// Recibir nuestra propia información al conectar
socket.on('my-info', (info) => {
    myInfo = info;
});

// Unirse a la sala
socket.emit('join-room', roomId);

let typingTimeout;

// Escuchar lo que escribe el usuario local
editor.addEventListener('input', () => {
    const content = editor.value;
    socket.emit('text-change', { roomId, content });
    
    // Emitir evento indicando que estamos escribiendo
    socket.emit('typing', { roomId });
});

// Sincronizar cambios de texto
socket.on('text-update', (content) => {
    if (editor.value === content) return;

    const cursorStart = editor.selectionStart;
    const cursorEnd = editor.selectionEnd;
    
    editor.value = content;
    
    if (document.activeElement === editor) {
        editor.setSelectionRange(cursorStart, cursorEnd);
    }
});

// Actualizar la barra superior con la lista de usuarios en la sala
socket.on('room-users', (users) => {
    usersListEl.innerHTML = ''; // Limpiar lista
    
    users.forEach(user => {
        const isMe = myInfo && myInfo.id === user.id;
        
        // Crear el "badge" o píldora del usuario
        const badge = document.createElement('div');
        badge.className = 'user-badge';
        
        // Crear el punto de color
        const dot = document.createElement('div');
        dot.className = 'user-dot';
        dot.style.backgroundColor = user.color;
        
        // Nombre del usuario y (Tú) si corresponde
        const text = document.createElement('span');
        text.innerText = user.name + (isMe ? ' (Tú)' : '');
        text.style.color = user.color; // Letra con su color distintivo
        
        badge.appendChild(dot);
        badge.appendChild(text);
        usersListEl.appendChild(badge);
    });
});

// Mostrar el aviso visual cuando alguien más escribe
socket.on('user-typing', (data) => {
    typingIndicatorEl.innerText = `${data.name} está escribiendo...`;
    typingIndicatorEl.style.color = data.color;
    
    // Limpiar el aviso después de 1.5 segundos de inactividad
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        typingIndicatorEl.innerText = '';
    }, 1500);
});
