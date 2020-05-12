const User = require("../models/user");
const Blog = require("../models/blog");
const _ = require("lodash");
const formidable = require("formidable");
const fs = require("fs");
const slugify = require("slugify");
const {errorHandler} = require("../helpers/dbErrorHandler");

// READ
exports.read = (req, res) => {
	req.profile.hashed_password = undefined;
	return res.json(req.profile);
};

// PUBLIC PROFILE
exports.publicProfile = (req, res) => {
	let username = req.params.username;
	let user;
	let blogs;

	User.findOne({username}).exec((err, userFromDB) => {
		if(err || !userFromDB) {
			return res.status(400).json({
				error: "User not found"
			})
		}
		user = userFromDB;
		let userId = user._id;
		Blog.find({postedBy: userId})
		.populate("categories", "_id name slug")
		.populate("tags", "_id name slug")
		.populate("postedBy", "_id name")
		.sort({createdAt: -1})
		.limit(10)
		.select("_id title slug excerpt categories tags postedBy createdAt updatedAt")
		.exec((err, data) => {
			if(err) {
				return res.status(400).json({
					error: errorHandler(err)
				});
			}
			user.photo = undefined;
			user.hashed_password = undefined;
			res.json({
				user, blogs: data
			});
		});
	});
};

// UPDATE
exports.update = (req, res) => {
	let form = new formidable.IncomingForm();
	form.keepExtensions = true;
	form.parse(req, (err, fields, files) => {
		if(err) {
			return res.status(400).json({
				error: "Photo could not be uploaded"
			});
		}
		let user = req.profile;
		// user's existing role and email before update
        let existingRole = user.role;
        let existingEmail = user.email;
		
		if (fields && fields.username && fields.username.length > 12) {
            return res.status(400).json({
                error: 'Username should be less than 12 characters long'
            });
        }
 
        if (fields.username) {
            fields.username = slugify(fields.username).toLowerCase();
        }

		if(fields.password && fields.password.length < 6) {
			return res.status(400).json({
				error: "Password must be a minimum of 6 characters long"
			});
		}

		user = _.extend(user, fields);
		// user's existing role and email - dont update - keep it same
        user.role = existingRole;
        user.email = existingEmail;

		if(files.photo) {
			if(files.photo.size > 2000000) {
			return res.status(400).json({
				error: "Image should be less than 2mb"
			});
		}
		user.photo.data = fs.readFileSync(files.photo.path);
		user.photo.contentType = files.photo.type;
		}

		// SAVE USER
		user.save((err, result) => {
			if(err) {
				return res.status(400).json({
					error: errorHandler(err)
				});
			}
			user.hashed_password = undefined;
			user.salt = undefined;
			user.photo = undefined;
			res.json(user);
		});
	});
};

// PHOTO
exports.photo = (req, res) => {
	const username = req.params.username;
	User.findOne({username}).exec((err, user) => {
		if(err || !user) {
			return res. status(400).json({
				error: "User not found"
			});
		}
		if(user.photo.data) {
			res.set("Content-Type", user.photo.contentType);
			return res.send(user.photo.data);
		}
	});
};
