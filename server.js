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

// Historial persistente en memoria: guarda un arreglo de mensajes por cada sala
const messages = {}; // roomId -> Array de objetos mensaje
let anonymousCounter = 1;
const users = {}; // socket.id -> { name, color, roomId }

// Lista de colores distintivos para los usuarios
const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

io.on('connection', (socket) => {
    // Asignar nombre secuencial y color aleatorio o secuencial
    const name = `Anonymous ${anonymousCounter}`;
    const color = colors[anonymousCounter % colors.length];
    anonymousCounter++;
    
    users[socket.id] = { name, color, roomId: null };
    
    // Enviar al propio cliente su información
    socket.emit('my-info', { id: socket.id, name, color });

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        users[socket.id].roomId = roomId;
        console.log(`${name} se unió a la sala: ${roomId}`);
        
        // Inicializar el arreglo de historial si la sala es nueva
        if (messages[roomId] === undefined) {
            messages[roomId] = [];
        }
        
        // Enviar todo el historial de la sala al usuario que acaba de entrar
        socket.emit('chat-history', messages[roomId]);
        
        // Actualizar la lista de usuarios
        emitRoomUsers(roomId);
    });

    // Escuchar cuando alguien envía un mensaje de chat
    socket.on('chat-message', (data) => {
        const user = users[socket.id];
        const messageObj = {
            id: Date.now().toString(),
            text: data.content,
            senderId: socket.id,
            senderName: user.name,
            senderColor: user.color,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        // Guardar en el historial
        messages[data.roomId].push(messageObj);
        
        // Hacer broadcast a TODOS en la sala, incluyendo al que lo envió (para que él también lo pinte)
        io.to(data.roomId).emit('new-message', messageObj);
    });
    
    // Escuchar cuando alguien está escribiendo
    socket.on('typing', (data) => {
        socket.to(data.roomId).emit('user-typing', { name: users[socket.id].name, color: users[socket.id].color });
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            console.log(`${user.name} se desconectó`);
            const roomId = user.roomId;
            delete users[socket.id];
            
            if (roomId) {
                emitRoomUsers(roomId);
            }
        }
    });
    
    function emitRoomUsers(roomId) {
        const roomUsers = Object.entries(users)
            .filter(([id, user]) => user.roomId === roomId)
            .map(([id, user]) => ({ id, name: user.name, color: user.color }));
        io.to(roomId).emit('room-users', roomUsers);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
