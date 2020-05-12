const User = require("../models/user");
const Blog = require("../models/blog");
const shortId = require("shortid");
const jwt = require("jsonwebtoken");
const expressJwt = require("express-jwt");
const {errorHandler} = require("../helpers/dbErrorHandler");
const _ = require("lodash");
const {OAuth2Client} = require("google-auth-library");
// sendgrid
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// PRE SIGNUP - ACCOUNT ACTIVATION
exports.preSignup = (req, res) => {
	// grab info from client side
	const {name, email, password} = req.body;
	// find if user exists
	User.findOne({email: email.toLowerCase()}, (err, user) => {
		// if user exists
		if(user) {
			return res.status(400).json({
				error: "Email is taken"
			});
		}
		// otherwise generate a token (id and secret) with expiry
		const token = jwt.sign({name, email, password}, process.env.JWT_ACCOUNT_ACTIVATION, {expiresIn: "10m"});
		
		// create email data
		const emailData = {
		from: process.env.EMAIL_FROM,
		to: email,
		subject: `Account Activation link`,
		html: `
			<p>Please use the following link to activate your account:</p>
			<p>${process.env.CLIENT_URL}/auth/account/activate/${token}</p>
			<hr />
			<p>This email may contain sensitive information.</p>
			<p>https://websitegoeshere.com</p>
		`		
		};

		// use sendgrid to send the user email
		sgMail.send(emailData).then(sent => {
			return res.json({
				message: `Email has been sent to ${email}. Follow the instructions to activate your account.`
			});
		});
	});
};

// SIGN UP
exports.signup = (req, res) => {
	// get data
	const token = req.body.token;
	// verify token
	if(token) {
		jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function(err, decoded) {
			if(err) {
				return res.status(401).json({
					error: "Expired link - sign up again"
				});
			}
			// decode token for user info
			const {name, email, password} = jwt.decode(token);
			// generate username
			let username = shortId.generate();
			// generate profile
			let profile = `${process.env.CLIENT_URL}/profile/${username}`;
			// create the new User
			const user = new User({name, email, password, profile, username})
			// save the User
			user.save((err, user) => {
				if(err) {
					return res.status(401).json({
						error: errorHandler(err)
					});
				}
				return res.json({
					message: "You have successfully activated your accout - please sign in"
				});
			});
		});
	// 
	} else {
		return res.json({
			message: "Something went wrong - try again"
		});
	}
};

// SIGN IN
exports.signin = (req, res) => {
	const {email, password} = req.body;
	// check if user exists
	User.findOne({email}).exec((err, user) => {
		// if error or no user
		// if user doesn't exist, ask to signup
		if(err || !user) {
			return res.status(400).json({
				error: "User with that email does not exist - please sign up."
			});
		}
		// authenticate
		if(!user.authenticate(password)) {
			// if not true
			return res.status(400).json({
				error: "Email and password did not match."
			});
		}
		// generate a token and send to client
		const token = jwt.sign({_id: user._id}, process.env.JWT_SECRET, {expiresIn: "1d"});

		res.cookie("token", token, {expiresIn: "1d"});
		const {_id, username, name, email, role} = user;
		return res.json({
			token,
			user: {_id, username, name, email, role}
		});
	});
};

// SIGN OUT
exports.signout = (req, res) => {
	res.clearCookie("token");
	res.json({
		message: "Signout success!"
	});
};

// REQUIRE SIGNIN
exports.requireSignin = expressJwt({
    secret: process.env.JWT_SECRET // req.user
});


// AUTH MIDDLEWARE
exports.authMiddleware = (req, res, next) => {
	// based on id
	const authUserId = req.user._id;
	// query the db
	User.findById({_id: authUserId}).exec((err, user) => {
		if(err || !user) {
			return res.status(400).json({
				error: "User not found"
			});
		}
		// get user
		req.profile = user;
		next();
	});
};

// ADMIN MIDDLEWARE
exports.adminMiddleware = (req, res, next) => {
	// based on id
	const adminUserId = req.user._id;
	// query the db
	User.findById({_id: adminUserId}).exec((err, user) => {
		if(err || !user) {
			return res.status(400).json({
				error: "User not found"
			});
		}
		// if not admin
		if(user.role !== 1) {
			return res.status(400).json({
				error: "Admin resource - Access Denied"
			});
		}
		// get user
		req.profile = user;
		next();
	});
};

// CAN UPDATE AND DELETE BLOG MIDDLEWARE
exports.canUpdateDeleteBlog = (req, res, next) => {
	const slug = req.params.slug.toLowerCase();
	Blog.findOne({slug}).exec((err, data) => {
		if(err) {
			return res.status(400).json({
				error: errorHandler(err)
			});
		}
		// data is the blog based on slug
		// authorized user if blog creator is same as current user
		let authorizedUser = data.postedBy._id.toString() === req.profile._id.toString();
		if(!authorizedUser) {
			return res.status(400).json({
				error: "You are not authorized"
			});
		}
		next();
	});
};

// FORGOT PASSWORD
exports.forgotPassword = (req, res) => {
	// grab email
	const {email} = req.body;
	// find user based on that email
	User.findOne({email}, (err, user) => {
		// if error or no user
		if(err || !user) {
			return res.status(401).json({
				error: "User with that email does not exist"
			});
		}

		// otherwise generate a token (id and secret) with expiry
		const token = jwt.sign({_id: user._id}, process.env.JWT_RESET_PASSWORD, {expiresIn: "10m"});
		// create email data
		const emailData = {
		from: process.env.EMAIL_FROM,
		to: email,
		subject: `Password reset link`,
		html: `
			<p>Please use the following link to reset your password:</p>
			<p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
			<hr />
			<p>This email may contain sensitive information.</p>
			<p>https://websitegoeshere.com</p>
		`		
		};
		// populating the db > user > resetPasswordLink
		return user.updateOne({resetPasswordLink: token}, (err, success) => {
			if(err) {
				return res.json({error: errorHandler(err)});
			} else {
				// send email with the token
				sgMail.send(emailData).then(sent => {
					return res.json({
						message: `Email has been sent to ${email}. Follow the instructions to reset your password. Link expires in 10 minutes.`
					});
				});
			}
		});
		
	});
};

// RESET PASSWORD
exports.resetPassword = (req, res) => {
	// grab resetpasswordlink and new password from client side
	const {resetPasswordLink, newPassword} = req.body;
	// if we have link check to see if expired
	if(resetPasswordLink) {
		// to verify pass the token and the secret key
		jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, function(err, decoded) {
			if(err) {
				return res.status(401).json({
					error: "Expired link - try again"
				});
			}
			// find user based on resetpasswordlink
			User.findOne({resetPasswordLink}, (err, user) => {
				// if error or no user
				if(err || !user) {
					return res.status(401).json({
						error: "Something went wrong - try later"
					});
				}
				// o/w update user password with new password
				const updatedFields = {
					password: newPassword,
					resetPasswordLink: ""
				};
				// use lodash to update any fields that have changed
				user = _.extend(user, updatedFields);
				// save updated user
				user.save((err, result) => {
					// if error
					if(err) {
						return res.status(400).json({
							error: errorHandler(err)
						});
					}
					// o/w send success message
					res.json({
						message: `Password updated successfully - you can now sign in with your new password`
					});
				});
			});
		});
	}	
};

// GOOGLE OAUTH LOGIN
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
exports.googleLogin = (req, res) => {
	const idToken = req.body.tokenId;
	// verify using package
	client.verifyIdToken({idToken, audience: process.env.GOOGLE_CLIENT_ID}).then(response => {
		const {email_verified, name, email, jti} = response.payload;
		// if verified
		if(email_verified) {
			// see if user exists in db
			User.findOne({email}).exec((err, user) => {
				// if existing user
				if(user) {
					// console.log(user);
					const token = jwt.sign({_id: user._id}, process.env.JWT_SECRET, {expiresIn: "1d"});
					res.cookie("token", token, {expiresIn: "1d"});
					// destructure from user
					const {_id, email, name, role, username} = user;
					return res.json({token, user: {_id, email, name, role, username}});
				} else {
					// create new User
					// generate username
					let username = shortId.generate();
					// generate profile
					let profile = `${process.env.CLIENT_URL}/profile/${username}`;
					let password = jti + process.env.JWT_SECRET;
					user = new User({name, email, profile, username, password});
					user.save((err, data) => {
						if(err) {
							return res.status(400).json({
								error: errorHandler(err)
							});
						}
						const token = jwt.sign({_id: data._id}, process.env.JWT_SECRET, {expiresIn: "1d"});
						res.cookie("token", token, {expiresIn: "1d"});
						// destructure from user
						const {_id, email, name, role, username} = data;
						return res.json({token, user: {_id, email, name, role, username}});
					});
				}
			});
		} else {
			return res.status(400).json({
				error: "Google login failed - try again"
			});
		}
	});
};

