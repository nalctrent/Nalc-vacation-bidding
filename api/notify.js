import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carrierName, roundNumber, selectedWeeks, nextCarrierName } = req.body;

  try {
    const data = await resend.emails.send({
      from: 'NALC Vacation Portal <onboarding@resend.dev>',
      to: [
        'nalctrent@gmail.com',
        'Jessica.branch366@gmail.com',
        '4173964312@tmomail.net',
        '4173565260@txt.att.net'
      ],
      subject: `NALC BID ALERT: Round ${roundNumber} - ${carrierName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 15px; color: #111;">
          <h2 style="color: #003366; margin-bottom: 4px;">NALC Branch 366 Vacation Alert</h2>
          <hr style="border: 0; border-top: 1px solid #ccc; margin-bottom: 12px;" />
          
          <p><strong>Carrier:</strong> ${carrierName}</p>
          <p><strong>Round:</strong> Round ${roundNumber}</p>
          <p><strong>Selected Weeks:</strong> ${selectedWeeks.join(', ')}</p>
          
          <div style="background-color: #e6f0fa; padding: 10px; border-radius: 6px; margin-top: 12px;">
            <p style="margin: 0; font-weight: bold; color: #003366;">
              👉 NEXT UP IN TURN: ${nextCarrierName || 'End of Roster'}
            </p>
          </div>
        </div>
      `,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
