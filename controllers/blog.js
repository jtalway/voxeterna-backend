const Blog = require("../models/blog");
const Category = require("../models/category");
const Tag = require("../models/tag");
const User = require("../models/user");
const formidable = require("formidable");
const slugify = require("slugify");
const stripHtml = require("string-strip-html");
const _ = require("lodash");
const {errorHandler} = require("../helpers/dbErrorHandler");
const fs = require("fs");
const {smartTrim} = require("../helpers/blog");

// CREATE
exports.create = (req, res) => {
	let form = new formidable.IncomingForm();
	form.keepExtensions = true;
	form.parse(req, (err, fields, files) => {
		// handle error
		if(err) {
			return res.status(400).json({
				error: "Image could not upload"
			});
		}

		// handle fields
		const {title, body, categories, tags} = fields;
		// title validation
		if(!title || !title.length) {
			return res.status(400).json({
				error: "Title is required"
			});
		}
		// body validation
		if(!body || body.length < 200) {
			return res.status(400).json({
				error: "Content is too short"
			});
		}
		// category validation
		if(!categories || categories.length === 0) {
			return res.status(400).json({
				error: "At least one category is required"
			});
		}
		// tag validation
		if(!tags || tags.length === 0) {
			return res.status(400).json({
				error: "At least one tag is required"
			});
		}

		let blog = new Blog();
		// blog title is going to be fields title (just title due to destructure above)
		blog.title = title; // same as fields.title
		blog.body = body; // same as fields.body
		blog.excerpt = smartTrim(body, 320, " ", " ...");
		blog.slug = slugify(title).toLowerCase();
		blog.mtitle = `${title} | ${process.env.APP_NAME}`;
		// take out hmtl and display first 160 characters - meta tag length
		blog.mdesc = stripHtml(body.substring(0, 160));
		// available thru req object with requireSignin
		blog.postedBy = req.user._id;
		// categories and tags
		let arrayOfCategories = categories && categories.split(",");
		let arrayOfTags = tags && tags.split(",");

		// handle files
		if(files.photo) {
			if(files.photo.size > 20000000) {
					return res.status(400).json({
						error: "Image should be less than 2mb in size"
					});
			}
			// per blogSchema
			blog.photo.data = fs.readFileSync(files.photo.path);
			blog.photo.contentType = files.photo.type;
		}

		// save blog
		blog.save((err, result) => {
			if(err) {
				return res.status(400).json({
					error: errorHandler(err)
				});
			}
			// res.json(result);
			// find blog by id and push categories
			Blog.findByIdAndUpdate(result._id, {$push: {categories: arrayOfCategories}}, {new: true}).exec((err, result) => {
				if(err) {
					return res.status(400).json({
						error: errorHandler(err)
					});
				} else {
					// push tags
					Blog.findByIdAndUpdate(result._id, {$push: {tags: arrayOfTags}}, {new: true}).exec((err, result) => {
						if(err) {
							return res.status(400).json({
								error: errorHandler(err)
							});
						} else {
							res.json(result);
						}
					});
				}
			});
		});
	});
};

// LIST
exports.list = (req, res) => {
	Blog.find({})
	.populate("categories", "_id name slug")
	.populate("tags", "_id name slug")
	.populate("postedBy", "_id name username")
	.sort({createdAt: -1})
	.select("_id title slug excerpt categories tags postedBy createdAt updatedAt mdesc")
	.exec((err, data) => {
		if(err) {
			return res.json({
				error: errorHandler(err)
			});
		}
		res.json(data);
	});
};

// LIST ALL BLOGS CATEGORIES TAGS
exports.listAllBlogsCategoriesTags = (req, res) => {
	let limit = req.body.limit ? parseInt(req.body.limit) : 10;
	let skip = req.body.skip ? parseInt(req.body.skip) : 0;

	let blogs;
	let categories;
	let tags;

	Blog.find({})
	.populate("categories", "_id name slug")
	.populate("tags", "_id name slug")
	.populate("postedBy", "_id name username profile")
	.sort({createdAt: -1})
	.skip(skip)
	.limit(limit)
	.select("_id title slug excerpt categories tags postedBy createdAt updatedAt mdesc")
	.exec((err, data) => {
		if(err) {
			return res.json({
				error: errorHandler(err)
			});
		}
		blogs = data; // blogs
		// get all categories
		Category.find({}).exec((err, c) => {
			if(err) {
				return res.json({
					error: errorHandler(err)
				});
			}
			categories = c; // categories
			// get all tags
			Tag.find({}).exec((err, t) => {
				if(err) {
					return res.json({
						error: errorHandler(err)
					});
				}
				tags = t; // tags
				// return all blogs categories and tags
				res.json({blogs, categories, tags, size: blogs.length});
			});
		});
	});
};

// READ
exports.read = (req, res) => {
	const slug = req.params.slug.toLowerCase();
	Blog.findOne({slug})
	// .select("photo")
	.populate("categories", "_id name slug")
	.populate("tags", "_id name slug")
	.populate("postedBy", "_id name username photo")
	.select("_id title body slug mtitle mdesc categories tags postedBy createdAt updatedAt")
	.exec((err, data) => {
		if(err) {
			return res.json({
				error: errorHandler(err)
			});
		}
		res.json(data);
	});
};

// REMOVE
exports.remove = (req, res) => {
	const slug = req.params.slug.toLowerCase();
	Blog.findOneAndRemove({slug}).exec((err, data) => {
			if(err) {
				return res.json({
					error: errorHandler(err)
				});
			}
			res.json({
				message: "Blog deleted successfully."
			});
		});
};

// UPDATE
exports.update = (req, res) => {
	// get slug
	const slug = req.params.slug.toLowerCase();

	// find the blog
	Blog.findOne({slug}).exec((err, oldBlog) => {
		if(err) {
			return res.status(400).json({
				error: errorHandler(err)
			});
		}

		let form = new formidable.IncomingForm();
		form.keepExtensions = true;

		// parse the form data
		form.parse(req, (err, fields, files) => {
			// handle error
			if(err) {
				return res.status(400).json({
					error: "Image could not upload"
				});
			}

			// keep the old blog slug
			let slugBeforeMerge = oldBlog.slug;

			// merge with new fields
			oldBlog = _.merge(oldBlog, fields);
			oldBlog.slug = slugBeforeMerge;

			const {body, mdesc, categories, tags} = fields;

			// update the excerpt, desc, categories and tags
			if(body) {
				oldBlog.excerpt = smartTrim(body, 320, " ", " ...");
				oldBlog.mdesc = stripHtml(body.substring(0, 160));
			}
			if(categories) {
				oldBlog.categories = categories.split(",");
			}
			if(tags) {
				oldBlog.tags = tags.split(",");
			}

			// update photo (if any)
			if(files.photo) {
				if(files.photo.size > 20000000) {
						return res.status(400).json({
							error: "Image should be less than 2mb in size"
						});
				}
				// per blogSchema
				oldBlog.photo.data = fs.readFileSync(files.photo.path);
				oldBlog.photo.contentType = files.photo.type;
			}

			// save blog
			oldBlog.save((err, result) => {
				if(err) {
					return res.status(400).json({
						error: errorHandler(err)
					});
				}
				// result.photo = undefined;
				res.json(result);
			});
		});
	});
};

// PHOTO
exports.photo = (req, res) => {
		const slug = req.params.slug.toLowerCase();
		Blog.findOne({slug})
		.select("photo")
		.exec((err, blog) => {
			// if error or no blog
			if(err || !blog) {
				return res.status(400).json({
					error: errorHandler(err)
				});
			}
			res.set("Content-Type", blog.photo.contentType);
			return res.send(blog.photo.data);
		});
};

// LIST RELATED
exports.listRelated = (req, res) => {
	let limit = req.body.limit ? parseInt(req.body.limit) : 6;
	// from blog, grab its id and list of categories
	const {_id, categories} = req.body.blog;

	// not including this blog, but including its categories
	Blog.find({_id: {$ne: _id}, categories: {$in: categories}})
	.limit(limit)
	.populate("postedBy", "_id name username profile")
	.sort({createdAt: -1})
	.select("title slug excerpt postedBy createdAt updatedAt mdesc")
	.exec((err, blogs) => {
		if(err) {
			return res.status(400).json({
				error: "Blogs not found"
			});
		}
		res.json(blogs);
	});
};

// LIST SEARCH
exports.listSearch = (req, res) => {
	console.log(req.query);
	const {search} = req.query;
	if(search) {
		Blog.find(
			{
				$or: [{title: {$regex: search, $options: "i"}}, {body: {$regex: search, $options: "i"}}]
			}, 
			(err, blogs) => {
				if(err) {
					return res.status(400).json({
						error: errorHandler(err)
					});
				}
				res.json(blogs);
			}
		)
		.select("-photo -body");
	}
};

// LIST BY USER
exports.listByUser = (req, res) => {
	User.findOne({username: req.params.username}).exec((err, user) => {
		if(err) {
			return res.status(400).json({
				error: errorHandler(err)
			});
		}
		let userId = user._id;
		Blog.find({postedBy: userId})
		.populate("categories", "_id name slug")
		.populate("tags", "_id name slug")
		.populate("postedBy", "_id name username")
		.sort({createdAt: -1})
		.select("_id title slug postedBy createdAt updatedAt")
		.exec((err, data) => {
			if(err) {
				return res.status(400).json({
				error: errorHandler(err)
				});
			}
			res.json(data);
		})
	});
};
