const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

const messages = {}; // roomId -> Array de mensajes
const registeredDevices = {}; // deviceId -> { name, color }
const activeSockets = {}; // socket.id -> { deviceId, roomId }

let anonymousCounter = 1;
// Tonos más monocromáticos/pastel para contrastar suavemente en fondo negro
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
        socket.join(roomId);
        activeSockets[socket.id].roomId = roomId;
        
        if (messages[roomId] === undefined) {
            messages[roomId] = [];
        }
        
        socket.emit('chat-history', messages[roomId]);
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
        
        messages[data.roomId].push(messageObj);
        io.to(data.roomId).emit('new-message', messageObj);
    });
    
    socket.on('typing', (data) => {
        socket.to(data.roomId).emit('user-typing', { deviceId, name: myIdentity.name, color: myIdentity.color });
    });

    // Validar contraseña y limpiar historial de la sala
    socket.on('clear-chat', (data) => {
        if (data.password === '27') {
            messages[data.roomId] = [];
            io.to(data.roomId).emit('chat-cleared');
            console.log(`El chat de la sala ${data.roomId} fue borrado por un administrador.`);
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
