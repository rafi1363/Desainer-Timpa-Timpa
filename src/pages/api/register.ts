import type { APIRoute } from 'astro';
import { Client } from 'pg';

// Fungsi ini akan berjalan di server Netlify setiap kali ada request POST ke /api/register
export const POST: APIRoute = async ({ request }) => {
  // 1. Ambil semua data yang dikirim dari formulir
  const formData = await request.formData();
  const nama_asli = formData.get('nama_asli');
  const nama_ig = formData.get('nama_ig');
  const nomor_telepon = formData.get('nomor_telepon');
  const jawaban_lain = formData.get('jawaban_lain');
  const karya = formData.get('karya'); // Ini adalah file, kita akan tangani nanti

  // Validasi sederhana: pastikan data penting tidak kosong
  if (!nama_asli || !nama_ig || !jawaban_lain) {
    return new Response(JSON.stringify({ message: "Nama lengkap, Instagram, dan alasan harus diisi." }), { status: 400 });
  }

  // TODO: Logika untuk upload file karya ke layanan storage.
  // Untuk sekarang, kita akan fokus menyimpan data teks terlebih dahulu.
  const karya_url = formData.get('karya_url');

  // 2. Siapkan koneksi ke database Neon menggunakan "kunci rahasia"
  const client = new Client({
    connectionString: import.meta.env.DATABASE_URL, // Membaca variabel dari Netlify
  });

  try {
    // 3. Buka koneksi ke database
    await client.connect();
    
    // 4. Siapkan perintah SQL untuk memasukkan data baru
    const query = `
      INSERT INTO applicants (nama_asli, nama_ig, nomor_telepon, jawaban_lain, karya_url) 
      VALUES ($1, $2, $3, $4, $5)
    `;
    const values = [nama_asli, nama_ig, nomor_telepon, jawaban_lain, karya_url];
    
    // 5. Eksekusi perintah SQL
    await client.query(query, values);
    
    // 6. Kirim respon sukses kembali ke front-end
    return new Response(JSON.stringify({
      message: "Pendaftaran berhasil! Silakan bergabung ke grup WhatsApp.",
      // Ganti dengan link grup WhatsApp Anda yang sebenarnya
      whatsapp_link: "https://chat.whatsapp.com/GANTIDENGANLINKGRUPANDA" 
    }), { status: 200 });

  } catch (error) {
    // Jika terjadi error (misal: koneksi gagal), kirim respon error
    console.error(error);
    return new Response(JSON.stringify({ message: "Terjadi kesalahan pada server." }), { status: 500 });

  } finally {
    // 7. Selalu tutup koneksi ke database setelah selesai
    await client.end();
  }
};