require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./db/userModel");
const Photo = require("./db/photoModel");
const connectDB = require("./db/dbConnection");

const app = express();
const port = process.env.PORT || 3001;

// Kết nối MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/images", express.static("public/images"));

// API: Danh sách người dùng (với count bubbles)
app.get("/user/list", async (req, res) => {
  try {
    const users = await User.find().select("_id first_name last_name").lean();
    const userList = await Promise.all(
      users.map(async (user) => {
        // Đếm số ảnh
        const photoCount = await Photo.countDocuments({ user_id: user._id });
        // Đếm số bình luận
        const commentCount = await Photo.aggregate([
          { $match: { "comments.user": mongoose.Types.ObjectId(user._id) } },
          { $unwind: "$comments" },
          { $match: { "comments.user": mongoose.Types.ObjectId(user._id) } },
          { $count: "count" },
        ]).then((result) => (result[0] ? result[0].count : 0));

        return {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          photoCount,
          commentCount,
        };
      })
    );
    res.json(userList);
  } catch (err) {
    console.error("Error fetching user list:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// API: Chi tiết người dùng
app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("_id first_name last_name location description occupation")
      .lean();
    if (!user) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(400).json({ error: "Invalid user ID" });
  }
});

// API: Ảnh của người dùng
app.get("/photosOfUser/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const photos = await Photo.find({ user_id: req.params.id })
      .select("_id user_id file_name date_time comments")
      .lean();

    const photoData = await Promise.all(
      photos.map(async (photo) => {
        const comments = await Promise.all(
          photo.comments.map(async (comment) => {
            const commentUser = await User.findById(comment.user)
              .select("_id first_name last_name")
              .lean();
            return {
              _id: comment._id,
              comment: comment.comment,
              date_time: comment.date_time,
              user: commentUser || { _id: comment.user, first_name: "Unknown", last_name: "" },
            };
          })
        );

        return {
          _id: photo._id,
          user_id: photo.user_id,
          file_name: photo.file_name,
          date_time: photo.date_time,
          comments,
        };
      })
    );

    res.json(photoData);
  } catch (err) {
    console.error("Error fetching photos:", err);
    res.status(400).json({ error: "Invalid user ID" });
  }
});

// API: Bình luận của người dùng
app.get("/commentsOfUser/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const photos = await Photo.find({
      "comments.user": mongoose.Types.ObjectId(req.params.id),
    }).lean();

    const comments = photos
      .flatMap((photo) =>
        photo.comments
          .filter((comment) => comment.user.toString() === req.params.id)
          .map((comment) => ({
            _id: comment._id,
            comment: comment.comment,
            date_time: comment.date_time,
            photo: {
              _id: photo._id,
              user_id: photo.user_id,
              file_name: photo.file_name,
            },
          }))
      )
      .sort((a, b) => new Date(b.date_time) - new Date(a.date_time));

    res.json(comments);
  } catch (err) {
    console.error("Error fetching user comments:", err);
    res.status(400).json({ error: "Invalid user ID" });
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});