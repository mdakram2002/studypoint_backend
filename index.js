const express = require("express");
const app = express();
const path = require("path");
const userRoute = require("./routes/User");
const courseRoute = require("./routes/Course");
const paymentRoute = require("./routes/Payments");
const profileRoute = require("./routes/Profile");
const contactRoute = require("./routes/ContactUs");

const database = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { cloudinaryConnect } = require("./config/cloudinary");
const fileUpload = require("express-fileupload");
const dotenv = require("dotenv");

dotenv.config();

// DB Connection
database.connect();

// Middlewares
app.use(express.json());
app.use(cookieParser());

const corsOptions = {
  origin: ["http://localhost:3000", "https://studypoint-frontend.vercel.app"],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

// Cloudinary
cloudinaryConnect();

// Routes
app.use("/api/v1/auth", userRoute);
app.use("/api/v1/profile", profileRoute);
app.use("/api/v1/contact", contactRoute);
app.use("/api/v1/course", courseRoute);
app.use("/api/v1/payment", paymentRoute);

// Health Check Route
app.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "StudyPoint backend is working 🚀",
  });
});

// Export app for Vercel
module.exports = app;