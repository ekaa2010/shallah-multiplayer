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

// 🧠 تخزين الغرف
let rooms = {};

function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

io.on("connection", (socket) => {
  console.log("✅ A user connected");

  socket.on("joinRoom", ({ roomId }) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      console.log(`🆕 Room ${roomId} created`);
    }

    const playerId = rooms[roomId].length;
    rooms[roomId].push({ id: socket.id, playerId });

    console.log(`👤 Player ${playerId} joined room ${roomId}`);
    io.to(socket.id).emit("playerIdAssigned", { playerId });

    if (rooms[roomId].length === 2) {
      console.log(`⌛ Room ${roomId} full. Starting countdown...`);
      io.to(roomId).emit("waitingStart", { countdown: 5 });

      let countdown = 5;
      const interval = setInterval(() => {
        countdown--;
        io.to(roomId).emit("waitingUpdate", { countdown });
        if (countdown <= 0) {
          clearInterval(interval);
          const startingPlayerId = Math.floor(Math.random() * 2);
          console.log(`🎮 Game starting in room ${roomId}`);
          io.to(roomId).emit("startGame", {
            playerCount: 2,
            targetScore: 101,
            startingPlayerId,
          });
        }
      }, 1000);
    }
  });

  // نقل أحداث الجيم بين اللاعبين
  socket.on("send-move", (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("receive-move", data);
    }
  });

  socket.on("roundEnd", (payload) => {
    console.log(`📦 Round ended in room ${socket.roomId}`);
    socket.to(socket.roomId).emit("roundEnd", payload);
  });

  socket.on("newRound", (payload) => {
    console.log(`🔄 New round in room ${socket.roomId}`);
    socket.to(socket.roomId).emit("newRound", payload);
  });

  socket.on("gameEnd", (payload) => {
    console.log(`🏁 Game ended in room ${socket.roomId}`);
    io.to(socket.roomId).emit("gameEnd", payload);
  });

  socket.on("disconnect", () => {
    console.log("❌ A user disconnected");

    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      } else {
        socket.to(roomId).emit("opponent-disconnected");
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
