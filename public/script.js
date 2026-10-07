const socket = io();

// Función para obtener el ID de la sala desde la URL o usar una sala global por defecto
const getRoomId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    if (!roomId) {
        // Si no hay sala, todos comparten la sala "general"
        roomId = 'general';
        window.history.pushState({}, '', `?room=${roomId}`);
    }
    return roomId;
};

const roomId = getRoomId();
const editor = document.getElementById('editor');

// Unirse a la sala tan pronto nos conectamos
socket.emit('join-room', roomId);

// Escuchar lo que escribe el usuario local y enviarlo al servidor
editor.addEventListener('input', () => {
    const content = editor.value;
    socket.emit('text-change', { roomId, content });
});

// Escuchar las actualizaciones de otros usuarios (o el estado inicial)
socket.on('text-update', (content) => {
    // Si el contenido es exactamente igual, no hacemos nada.
    // Esto evita que actualizaciones en bucle sobreescriban e interrumpan al que está escribiendo.
    if (editor.value === content) return;

    // Guardar la posición actual del cursor
    const cursorStart = editor.selectionStart;
    const cursorEnd = editor.selectionEnd;
    
    // Actualizar el contenido del textarea
    editor.value = content;
    
    // Restaurar el cursor solo si el usuario tiene el foco en el editor, 
    // previniendo saltos erráticos y bloqueos en la escritura.
    if (document.activeElement === editor) {
        editor.setSelectionRange(cursorStart, cursorEnd);
    }
});
