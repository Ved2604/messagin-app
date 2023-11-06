const express = require('express');
const { Server } = require('socket.io'); 
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const ioServer = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  },
});

const usersInRooms = {};

ioServer.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle room entry
  socket.on('enterRoom', ({ name, room }) => {
    socket.join(room); // Join the room
    socket.name = name; // Store the user's name on the socket
    socket.room = room; // Store the room on the socket

    // Add the user to the usersInRooms object
    if (!usersInRooms[room]) {
      usersInRooms[room] = [];
    }
    usersInRooms[room].push(socket.name);

    // Send welcome message to the user
    socket.emit('message', { name: 'Server', text: `Welcome to the room, ${name}!`, room });
    socket.emit('activeUsers', usersInRooms[room]); // Send the list of active users

    // Broadcast to all users in the room that a new user has joined
    socket.to(room).emit('message', { name: 'Server', text: `${name} has joined the room.`, room });
    socket.to(room).emit('activeUsers', usersInRooms[room]); // Broadcast the updated list of active users
  });

  // Handle incoming messages
  socket.on('message', (message) => {
    ioServer.to(message.room).emit('message', message); // Broadcast the message to all users in the room
  });

  socket.on('activity', (activity) => {
    ioServer.to(activity.room).emit('activity', activity); // Broadcast typing activity to all users in the room
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    if (socket.name && socket.room) {
      const disconnectedUser = 'Server';
      const disconnectedMessage = `${socket.name} has disconnected.`;

      // Remove the disconnected user from the usersInRooms object
      if (usersInRooms[socket.room]) {
        usersInRooms[socket.room] = usersInRooms[socket.room].filter((userName) => userName !== socket.name);
      }

      ioServer.to(socket.room).emit('message', { name: disconnectedUser, text: disconnectedMessage, room: socket.room });
      ioServer.to(socket.room).emit('activeUsers', usersInRooms[socket.room]); // Broadcast the updated list of active users
    }
  });
});
