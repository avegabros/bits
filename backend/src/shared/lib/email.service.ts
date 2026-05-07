import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false, // true for 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendWelcomeEmail = async (toEmail: string, employeeName: string, generatedPassword: string) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('[EmailService] SMTP credentials are not configured. Email was not sent.');
            return false;
        }

        const mailOptions = {
            from: `"BITS Admin" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: 'Welcome to BITS - Your Account Credentials',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #E60000;">Welcome to Biometric Integrated Timekeeping System (BITS)</h2>
                    <p>Hello ${employeeName},</p>
                    <p>Your employee account has been successfully created. You can now access the employee portal using the following credentials:</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${toEmail}</p>
                        <p style="margin: 0;"><strong>Password:</strong> <span style="font-family: monospace; font-size: 16px; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${generatedPassword}</span></p>
                    </div>

                    <p><strong>Security Notice:</strong> Please log in to the employee dashboard as soon as possible and change your password from the "My Profile" page.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br>BITS Administration Team</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Welcome email sent to ${toEmail}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Failed to send welcome email:', error);
        return false;
    }
};

export const sendPasswordResetEmail = async (toEmail: string, employeeName: string, generatedPassword: string) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('[EmailService] SMTP credentials are not configured. Email was not sent.');
            return false;
        }

        const mailOptions = {
            from: `"BITS Admin" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: 'BITS - Password Reset Notification',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #E60000;">BITS Account Password Reset</h2>
                    <p>Hello ${employeeName},</p>
                    <p>Your password has been successfully reset by an administrator. You can now access your account using the following temporary credentials:</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${toEmail}</p>
                        <p style="margin: 0;"><strong>Temporary Password:</strong> <span style="font-family: monospace; font-size: 16px; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${generatedPassword}</span></p>
                    </div>

                    <p><strong>Security Notice:</strong> You will be required to change this temporary password immediately upon your next login.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br>BITS Administration Team</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Password reset email sent to ${toEmail}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Failed to send password reset email:', error);
        return false;
    }
};
