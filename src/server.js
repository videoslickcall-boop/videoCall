import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import socketHandler from './socket/index.js';
import dotenv from 'dotenv'
dotenv.config()
import cron from 'node-cron';
import User from './models/user.js';
import Room from './models/room.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connect to MongoDB
connectDB();

// Serve frontend
// app.use(express.static('public'));
app.use("/vcall/api", express.static('public'));
app.use("/", (req, res) => res.status(200).send("Welcome !!");

// Run every minute
cron.schedule('* * * * *', async () => {
    try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        await User.updateMany(
            // { isBlock: true, blockTime: { $lte: tenMinutesAgo } },
            // { $set: { isBlock: false } }


            {
                blockDetails: {
                    $elemMatch: {
                        isBlock: true,
                        blockTime: { $lte: tenMinutesAgo }
                    }
                }
            },
            {
                $pull: {
                    blockDetails: {
                        isBlock: true,
                        blockTime: { $lte: tenMinutesAgo }
                    }
                }
            }
        );

        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

        const oldRooms = await Room.find({
            socketCount: 1,
            createdAt: { $lt: twoMinutesAgo }
        });

        oldRooms.map(async (item) => {
            if (item?.socketID1) {
                io.to(item?.socketID1).emit('reset-page');
            }
            else if (item?.socketID2) {
                io.to(item?.socketID2).emit('reset-page');
            }

            await Room.findByIdAndDelete(item?._id)
        })

    } catch (err) {
        console.error("❌ Error in unblock job:", err);
    }
});

app.post("/delete-all-rooms", async (req, res) => {
    try {
        if (req?.body?.number == process.env.number) {
            await Room.deleteMany({});
            return res.send('Room table cleared!');
        }
    } catch (error) {
        console.log("🚀 ~ app.post ~ error:", error)
        return res.send(error.message)
    }
})

// Setup socket.io
socketHandler(io);

const PORT = process.env.PORT;
server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});


