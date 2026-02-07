const nodemailer = require('nodemailer');
const twilio = require('twilio');
const Booking = require('../models/Booking');

// Email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Twilio client
const getTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
};

/**
 * Send booking confirmation email
 * @param {Object} booking - Booking object
 * @returns {Promise<void>}
 */
exports.sendBookingConfirmationEmail = async (booking) => {
  try {
    const transporter = createEmailTransporter();
    const adminEmail = process.env.ADMIN_EMAIL || 'info@doctorhousecalls.ca';

    const emailContent = `
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

    // Send to patient
    if (booking.contactEmail) {
      await transporter.sendMail({
        from: `"Winnipeg Doctor House Calls" <${process.env.EMAIL_USER}>`,
        to: booking.contactEmail,
        subject: 'Booking Request Received',
        html: emailContent
      });
    }

    // Send copy to admin
    await transporter.sendMail({
      from: `"Winnipeg Doctor House Calls" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `New Booking Request - ${booking.visitType === 'phone_call' ? 'Phone Call' : 'House Call'}`,
      html: `
        <h2>New Booking Request</h2>
        ${emailContent}
        <hr>
        <p><strong>Status:</strong> ${booking.status}</p>
        <p><strong>Zone:</strong> ${booking.matchedZoneName || 'Not matched'}</p>
        <p><a href="${process.env.FRONTEND_URL}/admin/bookings/${booking._id}">View Booking</a></p>
      `
    });
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw error;
  }
};

/**
 * Send booking confirmation SMS
 * @param {Object} booking - Booking object
 * @returns {Promise<void>}
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
    console.error('Error sending confirmation SMS:', error);
    throw error;
  }
};

/**
 * Send confirmation based on booking preferences
 * @param {Object} booking - Booking object
 * @returns {Promise<void>}
 */
exports.sendConfirmation = async (booking) => {
  try {
    if (booking.confirmationMethod === 'sms') {
      await exports.sendBookingConfirmationSMS(booking);
    } else {
      await exports.sendBookingConfirmationEmail(booking);
    }
    
    // Always send email copy to admin
    await exports.sendBookingConfirmationEmail(booking);
  } catch (error) {
    console.error('Error sending confirmation:', error);
    // Don't throw - we don't want to fail the booking if notification fails
  }
};
