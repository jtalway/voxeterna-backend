const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// CONTACT FORM
exports.contactForm = (req, res) => {
	const {email, name, message} = req.body;
	// console.log(req.body);

	const emailData = {
		to: process.env.EMAIL_TO,
		from: email,
		subject: `Contact form - ${process.env.APP_NAME}`,
		text: `Email received from contact form \n Sender name: ${name} \n Sender email: ${email} \n Sender message: ${message}`,
		html: `
			<h4>Email received from contact form:</h4>
			<p>Sender Name: ${name}</p>
			<p>Sender Email: ${email}</p>
			<p>Sender Message: ${message}</p>
			<hr />
			<p>This email may contain sensitive information.</p>
			<p>https://voxeterna.com</p>
		`		
	};
	sgMail.send(emailData).then(sent => {
		return res.json({
			success: true
		});
	});
};

// CONTACT BLOG AUTHOR FORM
exports.contactBlogAuthorForm = (req, res) => {
	const {authorEmail, email, name, message} = req.body;
	// console.log(req.body);

	const emailData = {
		to: authorEmail,
		from: email,
		subject: `Someone messaged you from ${process.env.APP_NAME}`,
		text: `Email received from contact form \n Sender name: ${name} \n Sender email: ${email} \n Sender message: ${message}`,
		html: `
			<h4>Message received from:</h4>
			<p>Name: ${name}</p>
			<p>Email: ${email}</p>
			<p>Message: ${message}</p>
			<hr />
			<p>This email may contain sensitive information.</p>
			<p>https://voxeterna.com</p>
		`		
	};
	console.log(emailData);
	sgMail.send(emailData).then(sent => {
		return res.json({
			success: true
		});
	});
};

