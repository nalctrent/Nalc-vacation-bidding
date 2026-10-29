import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to calculate 48-hour deadline excluding blackout weekend hours (Sat 4 PM to Mon 7:30 AM)
function calculateBiddingDeadline(startDate = new Date()) {
  const deadline = new Date(startDate.getTime() + 48 * 60 * 60 * 1000); // Base 48 hours

  const dayOfWeek = startDate.getDay(); // 0 = Sun, 6 = Sat
  const hour = startDate.getHours();
  const BLACKOUT_MS = 39.5 * 60 * 60 * 1000; // 39.5 hours from Sat 4 PM to Mon 7:30 AM

  // If bid is submitted during or spanning across the weekend window, add blackout offset
  if (
    (dayOfWeek === 5 && hour >= 16) || // Friday after 4 PM
    dayOfWeek === 6 ||                  // Saturday
    dayOfWeek === 0 ||                  // Sunday
    (dayOfWeek === 1 && hour < 7)       // Monday before 7:30 AM
  ) {
    deadline.setTime(deadline.getTime() + BLACKOUT_MS);
  }

  return deadline.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carrierName, round, selectedWeeks, nextCarrier } = req.body;
  const deadlineString = calculateBiddingDeadline(new Date());

  try {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #004b87;">NALC Branch 366 - Vacation Selection Locked In!</h2>
        <p><strong>Carrier:</strong> ${carrierName}</p>
        <p><strong>Round:</strong> ${round}</p>
        <p><strong>Selected Weeks:</strong> ${selectedWeeks}</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="font-size: 16px;">👉 <strong>Next Up to Bid:</strong> ${nextCarrier}</p>
        <p style="font-size: 15px; color: #d9534f;">⏰ <strong>Next Carrier's Decision Deadline:</strong> ${deadlineString}</p>
        <p style="color: #555; font-size: 14px;">Log into the steward board to send them their turn notification link!</p>
      </div>
    `;

    // Send notification emails to both Trenton and Jessica
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

    await Promise.all(emailPromises);

    return res.status(200).json({ 
      success: true, 
      deadline: deadlineString, 
      message: 'Notifications sent successfully with deadline calculation!' 
    });
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ error: error.message });
  }
}
