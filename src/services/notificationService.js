const nodemailer = require('nodemailer');
const twilio = require('twilio');

function isEmailConfigured() {
  const host = (process.env.EMAIL_HOST || '').trim();
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim();
  return Boolean(host && user && pass);
}

function createEmailTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST.trim(),
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER.trim(),
      pass: process.env.EMAIL_PASS
    }
  });
}

function buildBookingEmailHtml(booking) {
  return `
      <h2>Booking Request Received</h2>
      <p>Your appointment is being confirmed with our Dispatcher. They will be phoning you back shortly to confirm your appointment details.</p>
      
      <p>While our physicians are visiting patients until 9:00 pm daily, if this booking is outside of business hours (8:00am to 5:00pm), we may contact you the following day to confirm your appointment depending on today's call volumes.</p>
      
      <p><strong>If this is an emergency, please dial 911.</strong></p>
      
      <h3>Booking Details:</h3>
      <ul>
        <li><strong>Visit Type:</strong> ${booking.visitType === 'phone_call' ? 'Phone Call' : 'House Call'}</li>
        <li><strong>Patient:</strong> ${booking.patientInfo.firstName} ${booking.patientInfo.lastName}</li>
        <li><strong>Date of Birth:</strong> ${new Date(booking.patientInfo.dob).toLocaleDateString()}</li>
        <li><strong>Address:</strong> ${booking.address.normalized || booking.address.raw}</li>
        <li><strong>Phone:</strong> ${booking.contactPhone}</li>
        ${booking.contactEmail ? `<li><strong>Email:</strong> ${booking.contactEmail}</li>` : ''}
        ${booking.reasonForVisit ? `<li><strong>Reason:</strong> ${booking.reasonForVisit}</li>` : ''}
      </ul>
      
      <p>Booking ID: ${booking._id}</p>
    `;
}

// Twilio client
const getTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
};

/**
 * Email copy to internal admin inbox only (e.g. when patient confirmation was SMS).
 */
async function sendAdminBookingCopyEmail(booking) {
  const transporter = createEmailTransporter();
  if (!transporter) return;

  const adminEmail = process.env.ADMIN_EMAIL || 'info@doctorhousecalls.ca';
  const emailContent = buildBookingEmailHtml(booking);
  const from = `"Winnipeg Doctor House Calls" <${process.env.EMAIL_USER.trim()}>`;

  await transporter.sendMail({
    from,
    to: adminEmail,
    subject: `New Booking Request - ${booking.visitType === 'phone_call' ? 'Phone Call' : 'House Call'}`,
    html: `
        <h2>New Booking Request</h2>
        ${emailContent}
        <hr>
        <p><strong>Status:</strong> ${booking.status}</p>
        <p><strong>Zone:</strong> ${booking.matchedZoneName || 'Not matched'}</p>
        <p><a href="${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/admin/bookings/${booking._id}">View Booking</a></p>
      `
  });
}

/**
 * Send booking confirmation email to patient and admin copy
 */
exports.sendBookingConfirmationEmail = async (booking) => {
  const transporter = createEmailTransporter();
  if (!transporter) {
    console.warn(
      'Email not configured (set EMAIL_HOST, EMAIL_USER, EMAIL_PASS). Skipping confirmation email.'
    );
    return;
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'info@doctorhousecalls.ca';
    const emailContent = buildBookingEmailHtml(booking);
    const from = `"Winnipeg Doctor House Calls" <${process.env.EMAIL_USER.trim()}>`;

    if (booking.contactEmail) {
      await transporter.sendMail({
        from,
        to: booking.contactEmail,
        subject: 'Booking Request Received',
        html: emailContent
      });
    }

    await transporter.sendMail({
      from,
      to: adminEmail,
      subject: `New Booking Request - ${booking.visitType === 'phone_call' ? 'Phone Call' : 'House Call'}`,
      html: `
        <h2>New Booking Request</h2>
        ${emailContent}
        <hr>
        <p><strong>Status:</strong> ${booking.status}</p>
        <p><strong>Zone:</strong> ${booking.matchedZoneName || 'Not matched'}</p>
        <p><a href="${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/admin/bookings/${booking._id}">View Booking</a></p>
      `
    });
  } catch (error) {
    console.error('Error sending confirmation email:', error.message || error);
  }
};

/**
 * Send booking confirmation SMS
 */
exports.sendBookingConfirmationSMS = async (booking) => {
  try {
    const client = getTwilioClient();
    if (!client) {
      console.warn('Twilio not configured, skipping SMS');
      return;
    }

    const message = `Your booking request has been received. Our Dispatcher will contact you shortly to confirm your appointment. Booking ID: ${booking._id}. If this is an emergency, dial 911.`;

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: booking.contactPhone
    });
  } catch (error) {
    console.error('Error sending confirmation SMS:', error.message || error);
  }
};

/**
 * Send confirmation based on booking preferences
 */
exports.sendConfirmation = async (booking) => {
  try {
    if (booking.confirmationMethod === 'sms') {
      await exports.sendBookingConfirmationSMS(booking);
      await sendAdminBookingCopyEmail(booking);
    } else {
      await exports.sendBookingConfirmationEmail(booking);
    }
  } catch (error) {
    console.error('Error sending confirmation:', error.message || error);
  }
};
