const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*" }
});

// Room store: { roomId: { passcode: '1234' } }
const rooms = {};

io.on('connection', socket => {
    socket.on('join-room', ({ roomId, passcode, userId }) => {
        if (!rooms[roomId]) {
            // New room creation with passcode
            rooms[roomId] = { passcode: passcode || '' };
        } else if (rooms[roomId].passcode && rooms[roomId].passcode !== passcode) {
            socket.emit('error-msg', 'Incorrect room passcode!');
            return;
        }

        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
});

server.listen(3000, () => {
    console.log('Signaling server running on port 3000');
});
