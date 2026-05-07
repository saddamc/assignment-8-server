import nodemailer from "nodemailer";
import config from "../../../config";

const emailSender = async (to: string, html: string, subject: string = "E-Commerce Notification") => {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: config.emailSender.email,
            pass: config.emailSender.app_pass
        }
    });

    await transporter.sendMail({
        from: `"E-Commerce" <${config.emailSender.email}>`,
        to,
        subject,
        html
    });
};

export default emailSender;
