import type { APIRoute } from 'astro';
import { Client } from 'pg';

// Fungsi ini akan berjalan saat ada request GET ke /api/applicants
export const GET: APIRoute = async () => {
  // Siapkan koneksi ke database Neon
  const client = new Client({
    connectionString: import.meta.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Perintah SQL untuk mengambil semua data dari tabel applicants
    // Diurutkan berdasarkan yang paling baru mendaftar (created_at DESC)
    const query = `
      SELECT id, created_at, nama_asli, nama_ig, nomor_telepon, karya_url, jawaban_lain 
      FROM applicants 
      ORDER BY created_at DESC
    `;
    
    const result = await client.query(query);
    
    // Kirim data (result.rows) kembali sebagai respon JSON
    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: "Gagal mengambil data." }), { status: 500 });
  } finally {
    // Selalu tutup koneksi setelah selesai
    await client.end();
  }
};