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

// 🧠 تخزين الغرف واللاعبين
let rooms = {};

io.on("connection", (socket) => {
  console.log("✅ A user connected:", socket.id);

  // انضمام لاعب إلى غرفة
  socket.on("joinRoom", ({ roomId }) => {
    socket.join(roomId);
    socket.roomId = roomId;

    // لو الغرفة مش موجودة، أنشئها
    if (!rooms[roomId]) {
      rooms[roomId] = [];
      console.log(`🆕 Room ${roomId} created`);
    }

    // امنع تكرار نفس اللاعب
    if (!rooms[roomId].some(p => p.id === socket.id)) {
      const playerId = rooms[roomId].length; // 0 للأول، 1 للتاني
      rooms[roomId].push({ id: socket.id, playerId });

      console.log(`🎮 Player ${playerId} joined room ${roomId}`);
      console.log(`👥 Players now in room ${roomId}: ${rooms[roomId].map(p => p.playerId).join(", ")}`);

      // إرسال playerId للكلاينت
      io.to(socket.id).emit("playerIdAssigned", { playerId });
    }

    // لما الغرفة تكمل لاعبين
    if (rooms[roomId].length === 2) {
      console.log(`⌛ Room ${roomId} is full. Starting countdown...`);

      io.to(roomId).emit("waitingStart", { countdown: 5 });

      let secondsLeft = 5;
      const interval = setInterval(() => {
        secondsLeft--;
        io.to(roomId).emit("waitingUpdate", { countdown: secondsLeft });

        if (secondsLeft <= 0) {
          clearInterval(interval);
          console.log(`🚀 Starting game in room ${roomId}`);
          io.to(roomId).emit("startGame", {
            playerCount: 2,
            targetScore: 101,
            startingPlayerId: Math.floor(Math.random() * 2),
          });
        }
      }, 1000);
    }
  });

  // استقبال حركة اللعب
  socket.on("send-move", (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("receive-move", data);
    }
  });

  // قطع الاتصال
  socket.on("disconnect", () => {
    console.log("❌ A user disconnected:", socket.id);

    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);

      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`🗑️ Room ${roomId} deleted`);
      } else {
        socket.to(roomId).emit("opponent-disconnected");
        console.log(`⚠️ Player left. Remaining in room ${roomId}: ${rooms[roomId].map(p => p.playerId).join(", ")}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
