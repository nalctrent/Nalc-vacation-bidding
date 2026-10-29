import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carrierName, round, selectedWeeks, nextCarrier } = req.body;

  try {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #004b87;">NALC Branch 366 - Vacation Selection Locked In!</h2>
        <p><strong>Carrier:</strong> ${carrierName}</p>
        <p><strong>Round:</strong> ${round}</p>
        <p><strong>Selected Weeks:</strong> ${selectedWeeks}</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="font-size: 16px;">👉 <strong>Next Up to Bid:</strong> ${nextCarrier}</p>
        <p style="color: #555; font-size: 14px;">Log into the steward board to send them their turn notification text!</p>
      </div>
    `;

    // Email notifications to you and Jessica
    const emailPromises = [
      resend.emails.send({
        from: 'NALC Branch 366 <onboarding@resend.dev>',
        to: ['nalctrent@gmail.com'],
        subject: `🚨 [BID SUBMITTED] ${carrierName} completed ${round}`,
        html: emailHtml,
      }),
      resend.emails.send({
        from: 'NALC Branch 366 <onboarding@resend.dev>',
        to: ['Jessica.branch366@gmail.com'],
        subject: `🚨 [BID SUBMITTED] ${carrierName} completed ${round}`,
        html: emailHtml,
      })
    ];

    // Text notifications to Trenton (T-Mobile) and Jessica (AT&T)
    const textMessage = `NALC Alert: ${carrierName} completed ${round} (${selectedWeeks}). Next up: ${nextCarrier}.`;
    
    const textPromises = [
      resend.emails.send({
        from: 'NALC Branch 366 <onboarding@resend.dev>',
        to: ['4173964312@tmomail.net'],
        subject: '',
        text: textMessage,
      }),
      resend.emails.send({
        from: 'NALC Branch 366 <onboarding@resend.dev>',
        to: ['4178259096@txt.att.net'],
        subject: '',
        text: textMessage,
      })
    ];

    await Promise.all([...emailPromises, ...textPromises]);

    return res.status(200).json({ success: true, message: 'All notifications sent!' });
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ error: error.message });
  }
}
