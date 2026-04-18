import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, email } = await req.json();

  const orderId = `ANAKKAMPUS-${userId.substring(0,8)}-${Date.now()}`;

  const authString = Buffer.from(`YOUR_MIDTRANS_SERVER_KEY:`).toString('base64');
  // GANTI YOUR_MIDTRANS_SERVER_KEY dengan Server Key dari dashboard Midtrans kamu

  const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
    // GANTI KE PRODUCTION: https://app.midtrans.com/snap/v1/transactions
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: orderId,
        gross_amount: 15000,
      },
      customer_details: {
        email: email,
      },
      item_details: [{
        id: 'PREMIUM',
        price: 15000,
        quantity: 1,
        name: 'ANAK KAMPUS Premium',
      }],
    }),
  });

  const data = await response.json();

  if (!data.token) {
    return NextResponse.json({ error: 'Gagal membuat transaksi' }, { status: 500 });
  }

  return NextResponse.json({ token: data.token, orderId });
}