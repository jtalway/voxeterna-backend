const Category = require("../models/category");
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

  let category = new Category({name, slug});

  category.save((err, data)=> {
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
  Category.find({}).exec((err, data) => {
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

    Category.findOne({ slug }).exec((err, category) => {
        if (err) {
            return res.status(400).json({
                error: errorHandler(err)
            });
        }
        // res.json(category);
        Blog.find({ categories: category })
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
                res.json({ category: category, blogs: data });
            });
    });
};

// REMOVE
exports.remove = (req, res) => {
  const slug = req.params.slug.toLowerCase();

  Category.findOneAndRemove({slug}).exec((err, data) => {
      // error
    if(err) {
      return res.status(400).json({
        error: errorHandler(err)
      });
    }
    res.json({
      message: "Category deleted successfully"
    });
  });
};
