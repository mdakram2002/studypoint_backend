const mongoose = require("mongoose");
const Course = require("../models/Course");
const Category = require("../models/category");
const User = require("../models/User");
const { uploadImageToCloudinary } = require("../utils/imageUploader");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");
const { convertSecondsToDuration } = require("../utils/secToDuration");

exports.createCourse = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            courseName,
            courseDescription,
            whatYouWillLearn,
            price,
            tag: _tag,
            category,
            status = "Draft",
            instructions: _instructions,
        } = req.body;
        const thumbnail = req.files.thumbnailImage;
        const tag = Array.isArray(_tag) ? _tag : _tag ? JSON.parse(_tag) : [];
        const instructions = Array.isArray(_instructions)
            ? _instructions : _instructions ? JSON.parse(_instructions) : [];


        if (!thumbnail) {
            return res.status(400).json({
                success: false,
                message: "Thumbnail image is required."
            });
        }
        if (
            !courseName ||
            !courseDescription ||
            !whatYouWillLearn ||
            !price ||
            !tag.length ||
            !thumbnail ||
            !category ||
            !instructions.length
        ) {
            return res.status(400).json({
                success: false, message: "All fields are mandatory."
            });
        }
        console.log("THUBMNAIL IMAGE:", req.files.thumbnailImage);
        console.log("Files Received:", req.files);

        console.log("INSTRUCTIONS:", instructions);
        console.log("TAG:", tag);

        const instructorDetails = await User.findOne({
            _id: userId,
            accountType: "Instructor",
        });

        if (!instructorDetails) {
            return res.status(404).json({
                success: false, message: "Instructor details not found."
            });
        }

        const categoryDetails = await Category.findById(category);
        if (!categoryDetails) {
            return res.status(404).json({
                success: false, message: "Category details not found."
            });
        }

        const thumbnailImage = await uploadImageToCloudinary(
            thumbnail,
            process.env.FOLDER_NAME
        );
        console.log("Thumbnail Uploaded: ", thumbnailImage);

        const newCourse = await Course.create({
            courseName,
            courseDescription,
            instructor: instructorDetails._id,
            whatYouWillLearn: whatYouWillLearn,
            price,
            tag,
            category: categoryDetails._id,
            thumbnail: thumbnailImage.secure_url,
            status: status,
            instructions,
        });

        // add the new course to the user schema of the instructor
        await User.findByIdAndUpdate({ _id: instructorDetails._id },
            { $push: { courses: newCourse._id } },
            { new: true },
        );

        // Add new course to the category list
        await Category.findByIdAndUpdate({ _id: category },
            { $push: { courses: newCourse._id, } },
            { new: true },
        );

        return res.status(200).json({
            success: true,
            data: newCourse,
            message: "Course created successfully.",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to create course.",
            error: error.message,
        });
    }
};

// getAllCourse
exports.showAllCourses = async (req, res) => {
    try {
        const allCourse = await Course.find(
            {status: "Published"},
            {
                courseName: true,
                price: true,
                institution: true,
                ratingAndReview: true,
                studendEnrolled: true,
            }
        )
            .populate("instructor")
            .exec();

        return res.status(200).json({
            success: true,
            message: "Data for all courses fetchd successfully.",
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Failed to create course",
            error: err.message,
        });
    }
};

exports.getCoursesDetails = async (req, res) => {
    try {
        const { courseId } = req.body;
        console.log("COURSE ID FROM BACKEND: ", courseId)

        const courseDetails = await Course.findById({ _id: courseId })
            .populate({
                path: "instructor",
                populate: {
                    path: "additionalDetails",
                },
            })
            .populate("category")
            .populate("ratingAndReview")
            .populate({
                path: "courseContent",
                populate: {
                    path: "subSection",
                    // select: "-videoUrl",
                },
            })
            .exec();
        if (!courseDetails) {
            return res.status(404).json({
                success: false,
                message: `Could not find course with ${courseId}`,
            });
        }
        console.log("COURSE DEETAILS: ", courseDetails);

        let totalDurationInSeconds = 0;
        courseDetails.courseContent.forEach((content) => {
            content.subSection.forEach((subSection) => {
                const timeDurationInSeconds = parseInt(subSection.timeDuration);
                totalDurationInSeconds += timeDurationInSeconds;
            });
        });

        const totalDuration = convertSecondsToDuration(totalDurationInSeconds);

        return res.status(200).json({
            success: true,
            message: "Course Details Fetched Successfully",
            data: {
                courseDetails,
                totalDuration,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message || "Something went wrong, Please try again",
        });
    }
};

exports.getFullCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.user.id;
        const courseDetails = await Course.findOne({
            _id: courseId,
        })
            .populate({
                path: "instructor",
                populate: {
                    path: "additionalDetails",
                },
            })
            .populate("category")
            // .populate("ratingAndReviews")
            .populate({
                path: "courseContent",
                populate: {
                    path: "subSection",
                },
            })
            .exec();

        let courseProgressCount = await CourseProgress.findOne({
            courseID: courseId,
            userId: userId,
        });

        console.log("courseProgressCount : ", courseProgressCount);

        if (!courseDetails) {
            return res.status(400).json({
                success: false,
                message: `Could not find course with id: ${courseId}`,
            });
        }

        let totalDurationInSeconds = 0;
        courseDetails.courseContent.forEach((content) => {
            content.subSection.forEach((subSection) => {
                const timeDurationInSeconds = parseInt(subSection.timeDuration);
                totalDurationInSeconds += timeDurationInSeconds;
            });
        });

        const totalDuration = convertSecondsToDuration(totalDurationInSeconds);

        return res.status(200).json({
            success: true,
            data: {
                courseDetails,
                totalDuration,
                completedVideos: courseProgressCount?.completedVideos
                    ? courseProgressCount?.completedVideos
                    : [],
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.editCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        const updates = req.body;
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        // If Thumbnail Image is found, update it
        if (req.files) {
            console.log("thumbnail update");
            const thumbnail = req.files.thumbnailImage;
            const thumbnailImage = await uploadImageToCloudinary(
                thumbnail,
                process.env.FOLDER_NAME
            );
            course.thumbnail = thumbnailImage.secure_url;
        }

        // Update only the fields that are present in the request body
        for (const key in updates) {
            if (updates.hasOwnProperty(key)) {
                if (key === "tag" || key === "instructions") {
                    course[key] = JSON.parse(updates[key]);
                } else {
                    course[key] = updates[key];
                }
            }
        }

        await course.save();

        const updatedCourse = await Course.findOne({
            _id: courseId,
        })
            .populate({
                path: "instructor",
                populate: {
                    path: "additionalDetails",
                },
            })
            .populate("category")
            // .populate("ratingAndReviews")
            .populate({
                path: "courseContent",
                populate: {
                    path: "subSection",
                },
            })
            .exec();

        res.json({
            success: true,
            message: "Course updated successfully",
            data: updatedCourse,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal server error, From Course",
            error: error.message,
        });
    }
};
exports.getInstructorCourses = async (req, res) => {
  try {
    const instructorId = req.user.id;

    // Fetch courses with courseContent and subSection populated
    const instructorCourses = await Course.find({
      instructor: instructorId,
    })
      .populate({
        path: "courseContent",
        populate: {
          path: "subSection",
        },
      })
      .sort({ createdAt: -1 });

    // Calculate and add timeDuration to each course
    for (const course of instructorCourses) {
      let totalDurationInSeconds = 0;

      course.courseContent.forEach((section) => {
        section.subSection.forEach((sub) => {
          if (sub.timeDuration) {
            const duration = parseInt(sub.timeDuration);
            if (!isNaN(duration)) {
              totalDurationInSeconds += duration;
            }
          }
        });
      });

      // use a helper like convertSecondsToDuration()
      const hours = Math.floor(totalDurationInSeconds / 3600);
      const minutes = Math.floor((totalDurationInSeconds % 3600) / 60);
      course._doc.timeDuration = `${hours > 0 ? hours + "h " : ""}${minutes}min`;
    }

    res.status(200).json({
      success: true,
      data: instructorCourses,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve instructor courses",
      error: error.message,
    });
  }
};

exports.deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.body;

        // Find the course
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        // Unenroll students from the course
        const studentsEnrolled = course.studentsEnrolled;
        for (const studentId of studentsEnrolled) {
            await User.findByIdAndUpdate(studentId, {
                $pull: { courses: courseId },
            });
        }

        // Delete sections and sub-sections
        const courseSections = course.courseContent;
        for (const sectionId of courseSections) {
            // Delete sub-sections of the section
            const section = await Section.findById(sectionId);
            if (section) {
                const subSections = section.subSection;
                for (const subSectionId of subSections) {
                    await SubSection.findByIdAndDelete(subSectionId);
                }
            }

            // Delete the section
            await Section.findByIdAndDelete(sectionId);
        }

        // Delete the course
        await Course.findByIdAndDelete(courseId);

        return res.status(200).json({
            success: true,
            message: "Course deleted successfully",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

exports.updatedCourseProgress = async (req, res) => {
    try {
        const { courseId, subSectionId } = req.body;
        const userId = req.user.id;

        // Validate the input
        if (!courseId || !subSectionId) {
            return res.status(400).json({
                success: false,
                message: "Course ID and SubSection ID are required",
            });
        }

        // Check if the subsection exists
        const subSection = await SubSection.findById(subSectionId);
        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "SubSection not found",
            });
        }

        // Find the course progress document
        let courseProgress = await CourseProgress.findOne({
            courseID: courseId,
            userId: userId,
        });

        // If course progress doesn't exist, create a new one
        if (!courseProgress) {
            courseProgress = await CourseProgress.create({
                courseID: courseId,
                userId: userId,
                completedVideos: [subSectionId],
            });
        } else {
            // If the subsection is already completed, return a message
            if (courseProgress.completedVideos.includes(subSectionId)) {
                return res.status(200).json({
                    success: true,
                    message: "SubSection already marked as completed",
                });
            }

            // Add the subsection to the completedVideos array
            courseProgress.completedVideos.push(subSectionId);
            await courseProgress.save();
        }

        return res.status(200).json({
            success: true,
            message: "Course progress updated successfully",
            data: courseProgress,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Failed to update course progress",
            error: err.message,
        });
    }
};
