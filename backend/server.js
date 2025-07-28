const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// CORS configuration for frontend
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://your-username.github.io",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://your-username.github.io",
  credentials: true
}));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Room management
const rooms = new Map();

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running', 
    timestamp: new Date().toISOString(),
    rooms: Array.from(rooms.keys())
  });
});

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
        cursors: {},
        canvasState: null
      });
    }
    
    const room = rooms.get(roomId);
    room.users.add(socket.id);
    room.cursors[socket.id] = io.cursors[socket.id];
    
    // Send current canvas state to the new user if it exists
    if (room.canvasState) {
      socket.emit('canvas-state', room.canvasState);
    }
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', { username, roomId });
    
    console.log(`User ${username} joined room ${roomId}`);
  });

  // Handle canvas state updates
  socket.on('canvas-update', (canvasState) => {
    const roomId = socket.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.canvasState = canvasState;
      // Broadcast to other users in the room
      socket.to(roomId).emit('canvas-state', canvasState);
    }
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
      // Clear the stored canvas state
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.canvasState = null;
      }
    }
  });

});

// Start the server
server.listen(3000, () => {
    console.log(`Server running on http://localhost:${3000}`);
});