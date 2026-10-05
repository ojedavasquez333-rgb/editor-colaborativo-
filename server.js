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

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

io.on('connection', (socket) => {
    // Unirse a una sala específica
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Usuario conectado a la sala: ${roomId}`);
    });

    // Escuchar cambios de texto y transmitirlos a la misma sala
    socket.on('text-change', (data) => {
        socket.to(data.roomId).emit('text-update', data.content);
    });
    
    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
