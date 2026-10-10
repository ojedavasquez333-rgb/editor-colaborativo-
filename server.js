const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'messages.json');
let messages = {}; // roomId -> Array de mensajes
let roomLocks = {}; // roomId -> boolean

// Cargar datos persistentes al iniciar
try {
    if (fs.existsSync(DATA_FILE)) {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(rawData);
        if (data.messages) messages = data.messages;
        if (data.roomLocks) roomLocks = data.roomLocks;
        console.log('Historial y configuración restaurados desde messages.json');
    }
} catch (error) {
    console.error('Error cargando messages.json:', error);
}

// Función para guardar datos
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ messages, roomLocks }), 'utf8');
    } catch (error) {
        console.error('Error guardando messages.json:', error);
    }
}

const registeredDevices = {}; // deviceId -> { name, color }
const activeSockets = {}; // socket.id -> { deviceId, roomId }

let anonymousCounter = 1;
const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

io.on('connection', (socket) => {
    let deviceId = socket.handshake.auth.deviceId;
    if (!deviceId) {
        deviceId = `temp_${socket.id}`;
    }

    if (!registeredDevices[deviceId]) {
        registeredDevices[deviceId] = {
            name: `Anonymous ${anonymousCounter}`,
            color: colors[anonymousCounter % colors.length]
        };
        anonymousCounter++;
    }

    const myIdentity = registeredDevices[deviceId];
    activeSockets[socket.id] = { deviceId, roomId: null };
    
    socket.emit('my-info', { deviceId, name: myIdentity.name, color: myIdentity.color });

    socket.on('join-room', (roomId) => {
        if (roomLocks[roomId]) {
            socket.emit('room-locked-error');
            socket.disconnect(true);
            return;
        }

        socket.join(roomId);
        activeSockets[socket.id].roomId = roomId;
        
        if (messages[roomId] === undefined) {
            messages[roomId] = [];
        }
        
        socket.emit('chat-history', messages[roomId]);
        socket.emit('room-lock-changed', roomLocks[roomId] || false);
        emitRoomUsers(roomId);
    });

    socket.on('chat-message', (data) => {
        const messageObj = {
            id: Date.now().toString(),
            text: data.content,
            senderDeviceId: deviceId,
            senderName: myIdentity.name,
            senderColor: myIdentity.color,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        if (messages[data.roomId] === undefined) {
            messages[data.roomId] = [];
        }
        messages[data.roomId].push(messageObj);
        
        saveData(); // Guardar en archivo
        
        io.to(data.roomId).emit('new-message', messageObj);
    });
    
    socket.on('typing', (data) => {
        socket.to(data.roomId).emit('user-typing', { deviceId, name: myIdentity.name, color: myIdentity.color });
    });

    socket.on('clear-chat', (data) => {
        if (data.password === '27') {
            messages[data.roomId] = [];
            saveData(); // Guardar limpieza en archivo
            io.to(data.roomId).emit('chat-cleared');
            console.log(`El chat de la sala ${data.roomId} fue borrado por un administrador.`);
        }
    });

    socket.on('toggle-lock', (data) => {
        if (data.password === '27') {
            roomLocks[data.roomId] = !roomLocks[data.roomId];
            saveData(); // Guardar estado de bloqueo en archivo
            io.to(data.roomId).emit('room-lock-changed', roomLocks[data.roomId]);
            console.log(`La sala ${data.roomId} fue ${roomLocks[data.roomId] ? 'bloqueada' : 'desbloqueada'}.`);
        }
    });

    socket.on('kick-user', (data) => {
        if (data.password === '27') {
            const targetDeviceId = data.targetDeviceId;
            const socketsToKick = [];
            for (const [sId, info] of Object.entries(activeSockets)) {
                if (info.deviceId === targetDeviceId && info.roomId === data.roomId) {
                    socketsToKick.push(sId);
                }
            }
            
            socketsToKick.forEach(sId => {
                const targetSocket = io.sockets.sockets.get(sId);
                if (targetSocket) {
                    targetSocket.emit('kicked');
                    targetSocket.disconnect(true);
                }
            });
            console.log(`Usuario ${targetDeviceId} expulsado de la sala ${data.roomId}.`);
        }
    });

    socket.on('disconnect', () => {
        const socketInfo = activeSockets[socket.id];
        if (socketInfo) {
            const roomId = socketInfo.roomId;
            delete activeSockets[socket.id];
            
            if (roomId) {
                emitRoomUsers(roomId);
            }
        }
    });
    
    function emitRoomUsers(roomId) {
        const uniqueUsersMap = new Map();
        
        Object.values(activeSockets).forEach(info => {
            if (info.roomId === roomId) {
                const identity = registeredDevices[info.deviceId];
                if (identity) {
                    uniqueUsersMap.set(info.deviceId, {
                        deviceId: info.deviceId,
                        name: identity.name,
                        color: identity.color
                    });
                }
            }
        });

        const roomUsers = Array.from(uniqueUsersMap.values());
        io.to(roomId).emit('room-users', roomUsers);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
