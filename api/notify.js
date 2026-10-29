import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carrierName, roundNumber, selectedWeeks, nextCarrierName } = req.body;

  try {
    const { data, error } = await resend.emails.send({
      from: 'NALC Branch 366 <onboarding@resend.dev>',
      to: ['nalctrent@gmail.com'],
      subject: `🚨 [BID SUBMITTED] ${carrierName} completed Round ${roundNumber || 1}`,
      html: `
        <h2>NALC Branch 366 - Vacation Selection Locked In!</h2>
        <p><strong>Carrier:</strong> ${carrierName}</p>
        <p><strong>Round:</strong> Round ${roundNumber || 1}</p>
        <p><strong>Selected Weeks:</strong> ${Array.isArray(selectedWeeks) ? selectedWeeks.map(w => `Week ${w}`).join(', ') : 'None'}</p>
        <hr />
        <h3 style="color: #003366;">👉 Next Up to Bid: ${nextCarrierName || 'All Bidding Completed'}</h3>
        <p>Log into the steward board to send them their turn notification text!</p>
      `,
    });

    if (error) {
      return res.status(400).json({ error });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
