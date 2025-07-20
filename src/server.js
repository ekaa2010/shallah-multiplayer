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
  console.log("✅ A user connected");

  // انشاء غرفة جديدة
  socket.on("createRoom", ({ playerId }) => {
    // generate unique roomId
    const roomId = generateRoomCode(); // مثلا "BOOM23" 

    // تخزين الغرفة
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      console.log(`🆕 Room ${roomId} created by player ${playerId}`);
    }

    // playerId هو 0 لأنه أول واحد دخل
    rooms[roomId].push({ id: socket.id, playerId });

    console.log(`Player ${playerId} created room ${roomId}`);

    // ارسال كود الغرفة و playerId للعميل
    io.to(socket.id).emit("roomCreated", { roomId, playerId });

    // إرسال أن اللاعب قد تم إنشاؤه بنجاح
    io.to(socket.id).emit("playerIdAssigned", { playerId });

    // انتظر اللاعب الثاني للانضمام
    io.to(socket.id).emit("waiting", { message: "Waiting for an opponent..." });
  });

  // انضمام لاعب لغرفة
  socket.on("joinRoom", ({ roomId }) => {
    if (!rooms[roomId]) {
      // لو الغرفة مش موجودة، نرفض الانضمام
      console.log(`❌ Room ${roomId} does not exist`);
      io.to(socket.id).emit("roomNotFound", { message: "Room not found!" });
      return;
    }

    // لو الغرفة مليانة (2 لاعبين)، نرفض انضمام لاعب ثالث
    if (rooms[roomId].length === 2) {
      console.log(`❌ Room ${roomId} is full`);
      io.to(socket.id).emit("roomFull", { message: "Room is full!" });
      return;
    }

    // إضافة اللاعب للغرفة
    socket.join(roomId);
    socket.roomId = roomId;
    const playerId = rooms[roomId].length; // تعيين playerId: 0 أو 1

    rooms[roomId].push({ id: socket.id, playerId });

    console.log(`✅ Player ${playerId} joined room ${roomId}`);

    // إرسال playerId للعميل
    io.to(socket.id).emit("playerIdAssigned", { playerId });
    io.to(socket.id).emit("roomJoined", { roomId });

    // عندما يتم انضمام اللاعب الثاني، نبدأ العد التنازلي
    if (rooms[roomId].length === 2) {
      console.log(`⌛ Room ${roomId} is full. Starting countdown...`);
      io.to(roomId).emit("waitingStart", { countdown: 5 });

      let secondsLeft = 5;
      const interval = setInterval(() => {
        secondsLeft--;
        io.to(roomId).emit("waitingUpdate", { countdown: secondsLeft });

        if (secondsLeft <= 0) {
          clearInterval(interval);
          console.log(`🎮 Starting game in room ${roomId}`);
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
  console.log(`🚀 Server is running on port ${PORT}`);
});
