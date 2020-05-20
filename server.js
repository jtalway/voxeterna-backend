const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
// bring routes
const blogRoutes = require("./routes/blog");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const categoryRoutes = require("./routes/category");
const tagRoutes = require("./routes/tag");
const formRoutes = require("./routes/form");

// app
const app = express();

const sitemapOptions = {
    root: __dirname,
    headers: {
        'Content-Type': 'text/xml;charset=UTF-8'
    }
};

// db
mongoose
	.connect(process.env.DATABASE_LOCAL, {
		useNewUrlParser: true,
		useCreateIndex: true,
		useFindAndModify: false,
		useUnifiedTopology: true
	})
	.then(() => console.log("[+] Database connected."))
	.catch(err => {
		console.log(err);
	});

// middlewares
app.use(express.static('public'));
app.use(cors());
app.use(morgan("dev"));
// added 2 bodyparser lines to fix PayloadTooLargeError
app.use(bodyParser.urlencoded({
  limit: "50mb",
  extended: false
}));
app.use(bodyParser.json({limit: "50mb"}));
// app.use(bodyParser.json());
app.use(cookieParser());
// cors
if(process.env.NODE_ENV === "development") {
	app.use(cors({origin: `${process.env.CLIENT_URL}`}));
};
// routes middleware
app.use("/api", blogRoutes);
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", categoryRoutes);
app.use("/api", tagRoutes);
app.use("/api", formRoutes);

// serve sitemap
app.get('/sitemap.xml', (req, res) => res.status(200).sendFile('sitemap.xml', sitemapOptions));



// port
const port = process.env.PORT || 8000;
app.listen(port, () => {
	console.log(`[+] Server is running on port ${port}.`);
});
