const mongoose = require("mongoose");
require("dotenv").config();

const models = require("../modelData/models.js");
const User = require("../db/userModel.js");
const Photo = require("../db/photoModel.js");
const SchemaInfo = require("../db/schemaInfo.js");

const versionString = "1.0";

async function dbLoad() {
  // Kiểm tra biến môi trường
  if (!process.env.MONGODB_URI) {
    console.error("Error: MONGODB_URI is not defined in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Successfully connected to MongoDB Atlas!");
  } catch (error) {
    console.error("Error connecting to MongoDB Atlas:", error);
    process.exit(1);
  }

  try {
    // Xóa dữ liệu cũ
    await User.deleteMany({});
    await Photo.deleteMany({});
    await SchemaInfo.deleteMany({});
    console.log("Cleared old data");

    // Thêm users
    const userModels = models.userListModel();
    const mapFakeId2RealId = {};
    for (const user of userModels) {
      const userObj = new User({
        _id: user._id, // Gán _id thủ công
        first_name: user.first_name,
        last_name: user.last_name,
        location: user.location,
        description: user.description,
        occupation: user.occupation,
      });
      await userObj.save();
      mapFakeId2RealId[user._id] = userObj._id;
      user.objectID = userObj._id;
      console.log(
        "Adding user:",
        user.first_name + " " + user.last_name,
        "with ID",
        user.objectID
      );
    }

    // Thêm photos
    const photoModels = [];
    const userIDs = Object.keys(mapFakeId2RealId);
    userIDs.forEach((id) => {
      photoModels.push(...models.photoOfUserModel(id));
    });
    for (const photo of photoModels) {
      const photoObj = new Photo({
        file_name: photo.file_name,
        date_time: photo.date_time,
        user_id: mapFakeId2RealId[photo.user_id],
        comments: photo.comments
          ? photo.comments.map((comment) => ({
              comment: comment.comment,
              date_time: comment.date_time,
              user_id: mapFakeId2RealId[comment.user._id], // Dùng _id thật
            }))
          : [],
      });
      await photoObj.save();
      photo.objectID = photoObj._id;
      console.log(
        "Adding photo:",
        photo.file_name,
        "of user ID",
        photoObj.user_id
      );
    }

    // Thêm schemaInfo
    const schemaInfo = await SchemaInfo.create({
      version: versionString,
    });
    console.log("SchemaInfo object created with version", schemaInfo.version);
  } catch (error) {
    console.error("Error loading data:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

dbLoad();