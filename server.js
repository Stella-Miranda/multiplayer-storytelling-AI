const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from /public
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Track online users: socket.id -> username
const users = {};

io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // User joins with a chosen name
  socket.on("join", (username) => {
    users[socket.id] = username;
    io.emit("system", `${username} joined the chat`);
    io.emit("user-list", Object.values(users));
    console.log(`[join] ${username}`);
  });

  // User sends a message
  socket.on("message", (text) => {
    const username = users[socket.id] || "Anonymous";
    io.emit("message", { username, text, time: new Date().toLocaleTimeString() });
  });

  // User disconnects
  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      delete users[socket.id];
      io.emit("system", `${username} left the chat`);
      io.emit("user-list", Object.values(users));
      console.log(`[-] ${username} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));