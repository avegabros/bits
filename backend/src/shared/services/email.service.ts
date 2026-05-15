import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendOvertimeStatusEmail = async (
    toEmail: string,
    employeeName: string,
    overtimeDate: Date,
    status: 'APPROVED' | 'REJECTED',
    reason?: string
) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('[EmailService] SMTP credentials not configured. Skipping email.');
            return false;
        }

        const dateStr = new Date(overtimeDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const isApproved = status === 'APPROVED';
        const color = isApproved ? '#10B981' : '#EF4444'; // Emerald or Red
        const emoji = isApproved ? '✅' : '❌';

        const mailOptions = {
            from: `"BITS Attendance System" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Overtime Request ${status} - ${dateStr}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                    <div style="background-color: ${color}; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Overtime Request ${status} ${emoji}</h1>
                    </div>
                    <div style="padding: 30px;">
                        <p style="font-size: 16px; color: #374151;">Hi <strong>${employeeName}</strong>,</p>
                        <p style="font-size: 16px; color: #374151;">
                            Your overtime request for <strong>${dateStr}</strong> has been reviewed and marked as 
                            <strong style="color: ${color};">${status}</strong> by your manager.
                        </p>
                        
                        ${reason ? `
                        <div style="background-color: #f9fafb; border-left: 4px solid ${color}; padding: 15px; margin-top: 20px; border-radius: 4px;">
                            <p style="margin: 0; font-size: 14px; color: #4b5563;"><strong>Manager's Note:</strong></p>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #374151;">${reason}</p>
                        </div>
                        ` : ''}
                        
                        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                            You can view the full details of your request by logging into the Employee Portal.
                            <br><br>
                            Best regards,<br>
                            BITS Attendance System
                        </p>
                    </div>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Overtime status email sent to ${toEmail} (${info.messageId})`);
        return true;
    } catch (error) {
        console.error('[EmailService] Failed to send email:', error);
        return false;
    }
};
