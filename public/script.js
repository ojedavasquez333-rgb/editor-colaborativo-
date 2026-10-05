const socket = io();

// Función para obtener el ID de la sala desde la URL o crear uno nuevo
const getRoomId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    if (!roomId) {
        // Generar un ID aleatorio si no existe y actualizar la URL
        roomId = Math.random().toString(36).substring(2, 10);
        window.history.pushState({}, '', `?room=${roomId}`);
    }
    return roomId;
};

const roomId = getRoomId();
const editor = document.getElementById('editor');

// Unirse a la sala
socket.emit('join-room', roomId);

// Escuchar lo que escribe el usuario y enviarlo al servidor
editor.addEventListener('input', () => {
    const content = editor.value;
    socket.emit('text-change', { roomId, content });
});

// Escuchar las actualizaciones de otros usuarios
socket.on('text-update', (content) => {
    // Guardar la posición actual del cursor para que no salte al actualizar
    const cursorStart = editor.selectionStart;
    const cursorEnd = editor.selectionEnd;
    
    // Actualizar el contenido
    editor.value = content;
    
    // Restaurar la posición del cursor
    editor.setSelectionRange(cursorStart, cursorEnd);
});
