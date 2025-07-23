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

  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
  });

  socket.on("fill", ({x, y}) => {
    socket.broadcast.emit("fill", {x, y});
  });

  socket.on("clear", () => {
    io.emit("clear");
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

});

// Start the server
server.listen(3000, () => {
    console.log(`Server running on http://localhost:${3000}`);
});