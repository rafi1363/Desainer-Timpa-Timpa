import type { APIRoute } from "astro";
import { Client } from "pg";
import nodemailer from "nodemailer"; // [PERUBAHAN] Import nodemailer
import crypto from "crypto";

const clientConfig = { connectionString: import.meta.env.DATABASE_URL };

export const POST: APIRoute = async ({ request, url }) => {
  const formData = await request.formData();
  const email = formData.get("email") as string;

  if (!email) {
    return new Response(JSON.stringify({ message: "Email harus diisi." }), {
      status: 400,
    });
  }

  const client = new Client(clientConfig);
  try {
    await client.connect();

    const userResult = await client.query(
      "SELECT * FROM members WHERE email = $1",
      [email]
    );
    if (userResult.rowCount === 0) {
      return new Response(
        JSON.stringify({
          message: "Jika email terdaftar, link reset akan dikirim.",
        }),
        { status: 200 }
      );
    }
    const user = userResult.rows[0];

    const resetToken = crypto.randomBytes(32).toString("hex");
    const password_reset_token = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const password_reset_expires = new Date(Date.now() + 15 * 60 * 1000);

    await client.query(
      "UPDATE members SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3",
      [password_reset_token, password_reset_expires, user.id]
    );

    const resetURL = `${url.origin}/reset-password?token=${resetToken}`;

    // --- [PERUBAHAN] Blok pengiriman email menggunakan Nodemailer ---
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: import.meta.env.GMAIL_ADDRESS,
        pass: import.meta.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"DTT Community" <${import.meta.env.GMAIL_ADDRESS}>`,
      to: email,
      subject: "Reset Password Akun DTT Anda",
      html: `
            <p>Halo ${user.username},</p>
            <p>Anda menerima email ini karena ada permintaan untuk mereset password akun Anda.</p>
            <p>Silakan klik link di bawah ini untuk melanjutkan. Link ini hanya valid selama 15 menit.</p>
            <a href="${resetURL}" style="padding: 10px 15px; background-color: #f7e479; color: black; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini.</p>
        `,
    });
    // --- AKHIR BLOK PERUBAHAN ---

    return new Response(
      JSON.stringify({
        message: "Jika email terdaftar, link reset akan dikirim.",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ message: "Terjadi kesalahan pada server." }),
      { status: 500 }
    );
  } finally {
    await client.end();
  }
};
