import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #0056b3;">Password Reset Request</h2>
        <p>You requested to reset your password. Please use the following OTP code:</p>
        <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${options.otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <hr/>
        <p style="font-size: 12px; color: #777;">If you did not make this request, please ignore this email.</p>
      </div>
    `
  };

  // 3. Send Email
  await transporter.sendMail(mailOptions);
};

export default sendEmail;