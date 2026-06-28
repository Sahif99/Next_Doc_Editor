import nodemailer from "nodemailer";

type InviteEmailInput = {
  to: string;
  inviterName: string;
  documentTitle: string;
  documentUrl: string;
  role: string;
};

export async function sendInviteEmail(input: InviteEmailInput) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    console.warn("Invite email skipped: SMTP_HOST, SMTP_USER, SMTP_PASS, or SMTP_FROM is missing.");
    return { sent: false, skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to: input.to,
    subject: `${input.inviterName} invited you to edit ${input.documentTitle}`,
    text: `${input.inviterName} invited you as ${input.role} on "${input.documentTitle}". Open it here: ${input.documentUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>You were invited to Next Docs</h2>
        <p><strong>${input.inviterName}</strong> invited you as <strong>${input.role}</strong> on <strong>${input.documentTitle}</strong>.</p>
        <p><a href="${input.documentUrl}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:12px;text-decoration:none;">Open document</a></p>
      </div>
    `,
  });

  return { sent: true, skipped: false };
}
