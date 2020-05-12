const Tag = require("../models/tag");
const Blog = require("../models/blog");
const slugify = require("slugify");
const {errorHandler} = require("../helpers/dbErrorHandler");

// CREATE
exports.create = (req, res) => {
  // get category name from req.body
  const {name} = req.body;
  // generate slug
  // use JS function to lower case everything
  let slug = slugify(name).toLowerCase();

  let tag = new Tag({name, slug});

  tag.save((err, data)=> {
    if(err) {
      return res.status(400).json({
        error: errorHandler(err)
      });
    }
    // return newly created category
    res.json(data);
  });
};

// LIST
exports.list = (req, res) => {
  // read all the categories
  Tag.find({}).exec((err, data) => {
    // error
    if(err) {
      return res.status(400).json({
        error: errorHandler(err)
      });
    }
    // otherwise return all categories
    res.json(data);
  });
};

// SINGLE
exports.read = (req, res) => {
  const slug = req.params.slug.toLowerCase();

  Tag.findOne({slug}).exec((err, tag) => {
    // error
    if(err) {
      return res.status(400).json({
        error: "Tag not found"
      });
    }
    Blog.find({ tags: tag })
        .populate('categories', '_id name slug')
        .populate('tags', '_id name slug')
        .populate('postedBy', '_id name username')
        .sort({createdAt: -1})
        .select('_id title slug excerpt categories postedBy tags createdAt updatedAt mdesc')
        .exec((err, data) => {
            if (err) {
                return res.status(400).json({
                    error: errorHandler(err)
                });
            }
            res.json({ tag: tag, blogs: data });
        });
  });
};

// REMOVE
exports.remove = (req, res) => {
  const slug = req.params.slug.toLowerCase();

  Tag.findOneAndRemove({slug}).exec((err, data) => {
      // error
    if(err) {
      return res.status(400).json({
        error: errorHandler(err)
      });
    }
    res.json({
      message: "Tag deleted successfully"
    });
  });
};
