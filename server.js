const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =========================
// STATIC
// =========================

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// =========================
// STATE
// =========================

// socket.id -> username
const users = {};

// socket.id -> accumulated orange-mode text
const aiBuffers = {};

// =========================
// SOCKET
// =========================

io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // -------------------------
  // JOIN
  // -------------------------

  socket.on("join", (username) => {
    users[socket.id] = username;
    aiBuffers[socket.id] = [];

    io.emit("system", `${username} joined the chat`);
    io.emit("user-list", Object.values(users));

    console.log(`[join] ${username}`);
  });

  // -------------------------
  // NORMAL CHAT (BLUE)
  // -------------------------

  socket.on("message", (text) => {
    const username = users[socket.id] || "Anonymous";

    io.emit("message", {
      username,
      text,
      mode: "blue",
      time: new Date().toLocaleTimeString()
    });
  });

  // -------------------------
  // AI BUFFER MESSAGE (ORANGE)
  // -------------------------

  socket.on("ai-message", (text) => {
    const username = users[socket.id] || "Anonymous";

    if (!aiBuffers[socket.id]) {
      aiBuffers[socket.id] = [];
    }

    aiBuffers[socket.id].push(`${username}: ${text}`);

    // show orange messages publicly
    io.emit("message", {
      username,
      text,
      mode: "orange",
      time: new Date().toLocaleTimeString()
    });

    console.log(`[AI BUFFER] ${username}: ${text}`);
  });

  // -------------------------
  // SEND BUFFER TO AI
  // -------------------------

  socket.on("send-to-ai", () => {
    const username = users[socket.id] || "Anonymous";

    const buffer = aiBuffers[socket.id];

    if (!buffer || buffer.length === 0) {
      socket.emit("system", "AI buffer is empty.");
      return;
    }

    const fullPrompt = buffer.join("\n");

    console.log(`\n=== AI REQUEST FROM ${username} ===`);
    console.log(fullPrompt);

    socket.emit("system", "Sending accumulated context to AI...");

    // -------------------------
    // RUN PYTHON AI
    // -------------------------

    const py = spawn("python", ["ai.py"]);

    let result = "";
    let error = "";

    py.stdout.on("data", (data) => {
      result += data.toString();
    });

    py.stderr.on("data", (data) => {
      error += data.toString();
    });

    py.on("close", (code) => {
      if (code !== 0) {
        console.error(error);

        socket.emit("system", "AI crashed.");
        return;
      }

      io.emit("message", {
        username: "AI",
        text: result.trim(),
        mode: "ai",
        time: new Date().toLocaleTimeString()
      });

      console.log(`[AI RESPONSE]\n${result}`);

      // clear after send
      aiBuffers[socket.id] = [];
    });

    // send prompt to python
    py.stdin.write(fullPrompt);
    py.stdin.end();
  });

  // -------------------------
  // DISCONNECT
  // -------------------------

  socket.on("disconnect", () => {
    const username = users[socket.id];

    if (username) {
      delete users[socket.id];
      delete aiBuffers[socket.id];

      io.emit("system", `${username} left the chat`);
      io.emit("user-list", Object.values(users));

      console.log(`[-] ${username} disconnected`);
    }
  });
});

// =========================
// START
// =========================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
