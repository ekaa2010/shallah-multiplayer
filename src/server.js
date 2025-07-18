const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 🧠 ذاكرة لتخزين الغرف واللاعبين
let rooms = {};

io.on("connection", (socket) => {
  console.log("✅ A user connected");

  socket.on("disconnect", () => {
    console.log("❌ A user disconnected");

    // إزالة اللاعب من أي غرفة كان فيها
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
    }
  });

  // انضمام لاعب إلى غرفة
  socket.on("joinRoom", ({ roomId, playerId }) => {
    socket.join(roomId);
    console.log(`Player ${playerId} joined room ${roomId}`);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    // منع التكرار
    if (!rooms[roomId].some(p => p.id === socket.id)) {
      rooms[roomId].push({ id: socket.id, playerId });
    }

    // لما يبقى فيه لاعبين في الغرفة، نبدأ اللعب
    if (rooms[roomId].length === 2) {
      console.log(`🎮 Starting game in room ${roomId}`);
      io.to(roomId).emit("startGame", {
        playerCount: 2,
        targetScore: 101,
        startingPlayerId: Math.floor(Math.random() * 2),
      });
    }
  });

  // إرسال حركة اللعب للطرف الآخر
  socket.on("send-move", (data) => {
    socket.broadcast.emit("receive-move", data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
