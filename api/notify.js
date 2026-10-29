import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carrierName, round, choices, email } = req.body;

  try {
    const { data, error } = await resend.emails.send({
      from: 'NALC Branch 366 <onboarding@resend.dev>',
      to: [email || 'nalctrent@gmail.com'],
      subject: `Vacation Bid Confirmation - ${carrierName} (${round})`,
      html: `
        <h2>NALC Branch 366 - Vacation Bid Confirmation</h2>
        <p><strong>Carrier:</strong> ${carrierName}</p>
        <p><strong>Round:</strong> ${round}</p>
        <p><strong>Selected Weeks:</strong> ${Array.isArray(choices) ? choices.join(', ') : choices}</p>
        <p>Your selections have been successfully recorded and locked into the cloud database.</p>
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
