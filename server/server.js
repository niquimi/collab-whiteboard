const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static files
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/landing.html'));
});

app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/home.html'));
});

// Room management
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  // --- CURSOR SHARING LOGIC START ---
  // Fixed color palette
  const cursorColors = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
  ];
  // Store all users' cursors per room
  if (!io.cursors) io.cursors = {};
  if (!io.userCount) io.userCount = 0;

  // Assign name and color
  io.userCount++;
  const userName = `User ${io.userCount}`;
  const userColor = cursorColors[(io.userCount - 1) % cursorColors.length];
  io.cursors[socket.id] = { x: null, y: null, name: userName, color: userColor };

  // Send assigned name/color to client
  socket.emit('cursor-init', { name: userName, color: userColor });

  // Handle cursor move
  socket.on('cursor-move', ({ x, y }) => {
    if (io.cursors[socket.id]) {
      io.cursors[socket.id].x = x;
      io.cursors[socket.id].y = y;
      // Broadcast all cursors to everyone in the same room
      const room = socket.roomId;
      if (room) {
        socket.to(room).emit('cursors', io.cursors);
      }
    }
  });

  // Handle room joining
  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;
    
    // Update cursor info with username
    if (io.cursors[socket.id]) {
      io.cursors[socket.id].name = username;
    }
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Set(),
        cursors: {}
      });
    }
    
    const room = rooms.get(roomId);
    room.users.add(socket.id);
    room.cursors[socket.id] = io.cursors[socket.id];
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', { username, roomId });
    
    console.log(`User ${username} joined room ${roomId}`);
  });

  // On disconnect, remove cursor and user from room
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users.delete(socket.id);
      delete room.cursors[socket.id];
      
      // If room is empty, remove it
      if (room.users.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
    
    delete io.cursors[socket.id];
    if (roomId) {
      socket.to(roomId).emit('cursors', io.cursors);
    }
    console.log('User disconnected');
  });
  // --- CURSOR SHARING LOGIC END ---

  socket.on("draw", (data) => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.to(roomId).emit("draw", data);
    }
  });

  socket.on("fill", ({x, y, color}) => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.to(roomId).emit("fill", {x, y, color});
    }
  });

  socket.on("clear", () => {
    const roomId = socket.roomId;
    if (roomId) {
      io.to(roomId).emit("clear");
    }
  });

});

// Start the server
server.listen(3000, () => {
    console.log(`Server running on http://localhost:${3000}`);
});