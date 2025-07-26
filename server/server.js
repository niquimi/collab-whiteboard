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
app.use('/', require('./routes/home'));

io.on('connection', (socket) => {
  console.log('A user connected');

  // --- CURSOR SHARING LOGIC START ---
  // Fixed color palette
  const cursorColors = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
  ];
  // Store all users' cursors
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
      // Broadcast all cursors to everyone
      io.emit('cursors', io.cursors);
    }
  });

  // On disconnect, remove cursor
  socket.on('disconnect', () => {
    delete io.cursors[socket.id];
    io.emit('cursors', io.cursors);
    console.log('User disconnected');
  });
  // --- CURSOR SHARING LOGIC END ---

  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
  });

  socket.on("fill", ({x, y}) => {
    socket.broadcast.emit("fill", {x, y});
  });

  socket.on("clear", () => {
    io.emit("clear");
  });

});

// Start the server
server.listen(3000, () => {
    console.log(`Server running on http://localhost:${3000}`);
});