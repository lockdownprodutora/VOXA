import crypto from 'crypto';

async function run() {
  const testToken = process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN || process.env.MERCADO_PAGO_PROD_ACCESS_TOKEN;
  if (!testToken) {
    console.log("No token found in process.env");
    return;
  }

  const orderId = "ORDTST01M0K73TSY5HRR3R47B76TRMZG";
  try {
    const getResponse = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${testToken}`
      }
    });
    const getData = await getResponse.json();
    console.log("GET Status:", getResponse.status);
    console.log("GET Response:", JSON.stringify(getData, null, 2));
  } catch (err) {
    console.error("Error fetching order:", err);
  }
}

run();
