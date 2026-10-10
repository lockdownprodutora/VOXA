import crypto from 'crypto';

async function run() {
  const testToken = process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN || process.env.MERCADO_PAGO_PROD_ACCESS_TOKEN;
  if (!testToken) {
    console.log("No token found in process.env");
    return;
  }

  const uniqueId = `test_order_${Date.now()}`;
  const idempotencyKeyOrder = crypto.randomUUID();

  // Step 1: Create the Order
  const orderPayload = {
    type: "online",
    processing_mode: "manual",
    total_amount: "15.00",
    external_reference: uniqueId,
    items: [
      {
        title: "Ingresso Teste Lockdown",
        quantity: 1,
        unit_price: "15.00"
      }
    ],
    payer: {
      email: "test_buyer@testuser.com"
    }
  };

  try {
    console.log("--- Creating Order ---");
    const orderRes = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${testToken}`,
        "X-Idempotency-Key": idempotencyKeyOrder,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderRes.json();
    console.log("Order POST Status:", orderRes.status);
    if (!orderRes.ok || !orderData.id) {
      console.log("Order creation failed:", orderData);
      return;
    }
    const orderId = orderData.id;
    console.log("Order Created. ID:", orderId);

    // Step 2: Create a Pix Payment linked to this order
    console.log("\n--- Creating Pix Payment ---");
    const idempotencyKeyPayment = crypto.randomUUID();
    const paymentPayload = {
      transaction_amount: 15.00,
      payment_method_id: "pix",
      description: "Ingresso Teste Lockdown Payment",
      external_reference: uniqueId,
      order: {
        id: orderId
      },
      payer: {
        email: "test_buyer@testuser.com",
        first_name: "Test",
        last_name: "Buyer"
      }
    };

    const paymentRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${testToken}`,
        "X-Idempotency-Key": idempotencyKeyPayment,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(paymentPayload)
    });

    const paymentData = await paymentRes.json();
    console.log("Payment POST Status:", paymentRes.status);
    if (!paymentRes.ok || !paymentData.id) {
      console.log("Payment creation failed:", paymentData);
      return;
    }
    const paymentId = paymentData.id;
    console.log(`Payment Created. ID: ${paymentId}, Status: ${paymentData.status}`);

    // Step 3: Approve the Pix Payment via Sandbox Simulation PUT
    console.log("\n--- Simulating Payment Approval ---");
    const approveRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${testToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "approved"
      })
    });

    const approveData = await approveRes.json();
    console.log("Payment PUT Status:", approveRes.status);
    console.log("Payment Final Status:", approveData.status);

    // Step 4: Verify the Order status
    console.log("\n--- Querying Order Details ---");
    const getOrderRes = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${testToken}`
      }
    });
    const finalOrderData = await getOrderRes.json();
    console.log("Order GET Status:", getOrderRes.status);
    console.log("Order Final Response:", JSON.stringify(finalOrderData, null, 2));

  } catch (err) {
    console.error("Error in process:", err);
  }
}

run();
