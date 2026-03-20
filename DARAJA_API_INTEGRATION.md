# Daraja API Integration Guide

## Overview
This guide explains how to integrate Safaricom's Daraja API (M-Pesa) with your RentFlow Pro software for automated rent collection in Kenya.

---

## Prerequisites

Before integrating M-Pesa, ensure you have:

1. **Safaricom Developer Account** - Register at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. **M-Pesa Shortcode** - Get from Safaricom (typically 6-digit business shortcode)
3. **M-Pesa Secret (Passkey)** - Available in your developer dashboard
4. **Consumer Key & Secret** - Generated when you create an app in the developer portal

---

## Environment Setup

Create a `.env` file in your project root:

```env
# M-Pesa Configuration (Daraja API)
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=your_business_shortcode
MPESA_PASSKEY=your_passkey_here
MPESA_ENVIRONMENT=sandbox  # Use 'production' for live
MPESA_STK_SHORTCODE=your_stk_shortcode
MPESA_STK_CALLBACK_URL=https://yourdomain.com/api/mpesa/stk-callback
```

---

## Integration Steps

### Step 1: Install Required Dependencies

```bash
npm install axios crypto-js
```

### Step 2: Create M-Pesa Utility Module

Create a new file `mpesa.js` in your project:

```javascript
// mpesa.js - M-Pesa Daraja API Integration
const axios = require('axios');
const crypto = require('crypto-js');
require('dotenv').config();

const BASE_URL = process.env.MPESA_ENVIRONMENT === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';

// Generate Access Token
async function getAccessToken() {
    try {
        const auth = Buffer.from(
            `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
        ).toString('base64');

        const response = await axios.get(
            `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.response?.data || error.message);
        throw error;
    }
}

// Generate STK Push Password
function generateSTKPassword() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
}

// Initiate STK Push (Payment Request)
async function initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
        const accessToken = await getAccessToken();
        const { password, timestamp } = generateSTKPassword();

        const payload = {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerBuyGoodsOnline',
            Amount: Math.ceil(amount),
            PartyA: phoneNumber,
            PartyB: process.env.MPESA_SHORTCODE,
            PhoneNumber: phoneNumber,
            CallBackURL: process.env.MPESA_STK_CALLBACK_URL,
            AccountReference: accountReference,
            TransactionDesc: transactionDesc
        };

        const response = await axios.post(
            `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error initiating STK Push:', error.response?.data || error.message);
        throw error;
    }
}

// Query STK Push Status
async function querySTKStatus(checkoutRequestId) {
    try {
        const accessToken = await getAccessToken();
        const { password, timestamp } = generateSTKPassword();

        const payload = {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId
        };

        const response = await axios.post(
            `${BASE_URL}/mpesa/stkquery/v1/query`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error querying STK status:', error.response?.data || error.message);
        throw error;
    }
}

// Register C2B Callback URL
async function registerC2BURL() {
    try {
        const accessToken = await getAccessToken();

        const payload = {
            ShortCode: process.env.MPESA_SHORTCODE,
            ResponseType: 'Completed',
            ConfirmationURL: 'https://yourdomain.com/api/mpesa/c2b-confirm',
            ValidationURL: 'https://yourdomain.com/api/mpesa/c2b-validate'
        };

        const response = await axios.post(
            `${BASE_URL}/mpesa/c2b/v1/registerurl`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error registering C2B URL:', error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    getAccessToken,
    initiateSTKPush,
    querySTKStatus,
    registerC2BURL
};
```

### Step 3: Create API Routes

Add these routes to your `server.js`:

```javascript
// server.js - Add these routes

// STK Push Endpoint
app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
        const { phoneNumber, amount, accountReference } = req.body;
        
        // Validate phone number format (remove +254)
        const cleanPhone = phoneNumber.replace(/^254/, '');
        const formattedPhone = `254${cleanPhone}`;
        
        const result = await mpesa.initiateSTKPush(
            formattedPhone,
            amount,
            accountReference,
            'Rent Payment'
        );
        
        // Save checkout request ID to database for status tracking
        // This allows you to query the payment status later
        
        res.json({
            success: true,
            message: 'STK Push initiated successfully',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment',
            error: error.message
        });
    }
});

// STK Callback Handler (receives payment confirmation)
app.post('/api/mpesa/stk-callback', async (req, res) => {
    try {
        const callbackData = req.body;
        
        // Log the callback data for debugging
        console.log('STK Callback:', JSON.stringify(callbackData));
        
        const resultCode = callbackData.Body?.stkCallback?.ResultCode;
        const resultDesc = callbackData.Body?.stkCallback?.ResultDesc;
        const checkoutRequestId = callbackData.Body?.stkCallback?.CheckoutRequestID;
        
        if (resultCode === 0) {
            // Payment successful
            const metadata = callbackData.Body?.stkCallback?.CallbackMetadata?.Item;
            
            const amount = metadata?.find(i => i.Name === 'Amount')?.Value;
            const mpesaReceiptNumber = metadata?.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
            const phoneNumber = metadata?.find(i => i.Name === 'PhoneNumber')?.Value;
            
            // TODO: Update payment record in database
            // - Mark rent as paid
            // - Update payment status
            // - Send confirmation SMS
            
            console.log(`Payment successful: ${mpesaReceiptNumber}`);
        } else {
            // Payment failed
            console.log(`Payment failed: ${resultDesc}`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error processing STK callback:', error);
        res.status(500).json({ success: false });
    }
});

// C2B Confirmation (for receive money)
app.post('/api/mpesa/c2b-confirm', async (req, res) => {
    try {
        const { TransID, TransAmount, TransTime, MSISDN, AccRef } = req.body;
        
        console.log('C2B Payment received:', { TransID, TransAmount, AccRef });
        
        // TODO: Process the payment
        // - Find tenant by account reference
        // - Update payment record
        
        res.json({ success: true, ResponseCode: 0 });
    } catch (error) {
        console.error('Error processing C2B:', error);
        res.json({ success: false, ResponseCode: 1 });
    }
});

// Check Payment Status
app.get('/api/payment/status/:checkoutRequestId', async (req, res) => {
    try {
        const { checkoutRequestId } = req.params;
        const result = await mpesa.querySTKStatus(checkoutRequestId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to query payment status'
        });
    }
});
```

### Step 4: Frontend Integration

Update your frontend to initiate payments:

```javascript
// payment.js - Frontend payment handling

async function initiateRentPayment(phoneNumber, amount, tenantId) {
    try {
        const response = await fetch('/api/mpesa/stk-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: phoneNumber,
                amount: amount,
                accountReference: `RENT-${tenantId}`
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Please check your phone and enter your M-Pesa PIN');
            // Store checkoutRequestId for status checking
            localStorage.setItem('checkoutRequestId', data.data.CheckoutRequestID);
            
            // Poll for payment status
            checkPaymentStatus(data.data.CheckoutRequestID);
        } else {
            alert('Payment initiation failed: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    }
}

async function checkPaymentStatus(checkoutRequestId) {
    const maxAttempts = 30;
    let attempts = 0;
    
    const checkInterval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await fetch(`/api/payment/status/${checkoutRequestId}`);
            const data = await response.json();
            
            if (data.data?.ResultCode === 0) {
                clearInterval(checkInterval);
                alert('Payment successful! Thank you for your rent payment.');
                location.reload();
            } else if (data.data?.ResultCode !== undefined && data.data?.ResultCode !== 0) {
                clearInterval(checkInterval);
                alert('Payment was cancelled or failed.');
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
        
        if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            alert('Payment timeout. Please check your phone or contact support.');
        }
    }, 2000); // Check every 2 seconds
}
```

---

## Testing in Sandbox

### Using Test Credentials

1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create an app and get credentials
3. Use these test phone numbers:
   - `254708374881` - For successful payment simulation
   - `254709000000` - For failed payment simulation
4. Use any amount for testing

### Testing the Integration

```bash
# Test STK Push
curl -X POST http://localhost:3000/api/mpesa/stk-push \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254708374881",
    "amount": 1000,
    "accountReference": "TEST-001"
  }'
```

---

## Production Checklist

Before going live:

- [ ] Register production app on Safaricom Developer Portal
- [ ] Get production credentials (Consumer Key & Secret)
- [ ] Update `.env` with production values
- [ ] Set up SSL/HTTPS on your server
- [ ] Register production callback URLs
- [ ] Test with real M-Pesa transactions (small amounts)
- [ ] Implement proper error handling and logging
- [ ] Add SMS notifications for payment confirmations

---

## Important Notes

1. **Callback URLs must be HTTPS** - Safaricom requires secure URLs for live transactions
2. **Timestamp Format** - Must be in `YYYYMMDDHHmmss` format
3. **Amount** - Must be a positive integer (no decimals)
4. **Phone Format** - Use `254` prefix without `+` sign
5. **Concurrency** - Only one STK Push per phone number at a time

---

## Troubleshooting Common Issues

### "Missing Parameter" Error
- Check that all required fields are included in the request
- Ensure timestamp format is correct (YYYYMMDDHHmmss)

### "Invalid Credentials" Error
- Verify Consumer Key and Secret are correct
- Ensure you're using the right environment (sandbox vs production)

### "STK Push Not Received"
- Check phone number format (should be 254xxxxxxxxx)
- Ensure the phone has sufficient M-Pesa balance
- Check if there's already an STK request pending

### "Callback Not Received"
- Verify callback URL is publicly accessible (not localhost)
- Ensure SSL certificate is valid
- Check firewall allows incoming requests from Safaricom IPs

---

## Support Resources

- **Safaricom Developer Portal**: [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
- **API Documentation**: [safaricom.github.io/DarajaAPI](https://safaricom.github.io/DarajaAPI/)
- **Support Email**: apisupport@safaricom.co.ke

---

## How Payments Reach Your Account

### Payment Flow Overview

```
Tenant pays rent via M-Pesa → Money enters your M-Pesa Business Account → Withdraw to Bank
```

### Understanding the Money Flow

When tenants pay rent through STK Push:

1. **Tenant initiates payment** - Money is deducted from tenant's M-Pesa
2. **Money goes to your M-Pesa Business Account** - Your business shortcode receives the funds
3. **Funds sit in M-Pesa** - You can keep in M-Pesa or withdraw to bank

### Option 1: Keep in M-Pesa (Easiest)

- Money automatically lands in your M-Pesa business account
- Use M-Pesa for business expenses, payments to suppliers
- Withdraw cash from any M-Pesa agent when needed

### Option 2: Withdraw to Bank Account

To move money from M-Pesa to your bank account:

#### Method A: M-Pesa Super App
1. Open M-Pesa Super App
2. Go to "My Business" → "Withdraw to Bank"
3. Enter bank details and amount
4. Confirm transaction

#### Method B: USSD (*234#)
1. Dial *234#
2. Select "My Business"
3. Choose "Withdraw to Bank"
4. Enter bank code + account number
5. Amount and confirm

#### Method C: Automatic B2C (Business to Customer)

Set up automatic payouts to yourself:

```javascript
// Add this function to mpesa.js for B2C withdrawals
async function initiateB2C(phoneNumber, amount, commandID = 'BusinessPayment') {
    try {
        const accessToken = await getAccessToken();
        
        const payload = {
            InitiatorName: process.env.MPESA_INITIATOR_NAME,
            SecurityCredential: process.env.MPESA_B2C_SECURITY_CREDENTIAL,
            CommandID: commandID,
            Amount: Math.ceil(amount),
            PartyA: process.env.MPESA_SHORTCODE,
            PartyB: phoneNumber,
            Remarks: 'RentFlow withdrawal',
            QueueTimeOutURL: 'https://yourdomain.com/api/mpesa/b2c-timeout',
            ResultURL: 'https://yourdomain.com/api/mpesa/b2c-result'
        };

        const response = await axios.post(
            `${BASE_URL}/mpesa/b2c/v1/paymentrequest`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error initiating B2C:', error.response?.data || error.message);
        throw error;
    }
}
```

---

## Bank Codes for Withdrawals

Use these bank codes when withdrawing to bank:

| Bank | Code | Example Account |
|------|------|------------------|
| KCB | 01 | 01xxxxxx |
| Equity | 11 | 11xxxxxx |
| Co-operative | 11 | 11xxxxxx |
| Standard Chartered | 02 | 02xxxxxx |
| Absa | 03 | 03xxxxxx |
| Diamond Trust | 04 | 04xxxxxx |
| Stanbic | 05 | 05xxxxxx |
| National Bank | 06 | 06xxxxxx |
| I&M | 07 | 07xxxxxx |
| DTB | 08 | 08xxxxxx |
| CfC Stanbic | 05 | 05xxxxxx |
| Chase Bank | 09 | 09xxxxxx |
| Housing Finance | 10 | 10xxxxxx |
| Family Bank | 12 | 12xxxxxx |
| Gulf African | 13 | 13xxxxxx |
| Middle East Bank | 14 | 14xxxxxx |
| Victoria Mutual | 15 | 15xxxxxx |
| Credit | 16 | 16xxxxxx |
| Kenya Commercial Bank | 01 | 01xxxxxx |

**Format**: Use 6-digit bank code + your account number (no dashes)

---

## Setting Up Business Till (Paybill)

For easier collection, set up a Paybill number:

### Benefits of Paybill
- Customers can pay from any network
- Automatic reconciliation
- Multiple business users can pay into same account
- Works with bank apps, M-Pesa, agents

### How to Get a Paybill
1. Contact Safaricom Business Team: *100#
2. Or call 234
3. Or visit any Safaricom Shop
4. Provide:
   - Business name (registered)
   - Bank account for settlement
   - Contact details
5. Paybill typically costs KSh 1,000-2,500 one-time

### Paybill Configuration

```javascript
// Use Paybill in your .env
MPESA_PAYBILL=123456  // Your Paybill number
MPESA_TILL_NUMBER=    // Optional if using Paybill

// For Paybill transactions (Customer pays business)
app.post('/api/mpesa/paybill-callback', async (req, res) => {
    try {
        const { TransID, TransAmount, BillRefNumber, MSISDN } = req.body;
        
        // BillRefNumber could be tenant ID or house number
        console.log('Paybill payment:', { TransID, TransAmount, BillRefNumber });
        
        // Find tenant and update payment
        // const tenant = await findTenantByHouse(BillRefNumber);
        
        res.json({ success: true, ResponseCode: 0 });
    } catch (error) {
        res.json({ success: false, ResponseCode: 1 });
    }
});
```

---

## Complete Payment Integration Example

Here's a complete flow for receiving rent:

```javascript
// server.js - Complete payment flow

// 1. Tenant requests to pay rent
app.post('/api/rent/pay', async (req, res) => {
    const { tenantId, amount, phoneNumber } = req.body;
    
    // Initiate STK Push
    const result = await mpesa.initiateSTKPush(
        phoneNumber,
        amount,
        `RENT-${tenantId}`,  // Account reference
        `Rent payment for tenant ${tenantId}`
    );
    
    // Save pending payment to database
    await db.payment.create({
        tenantId,
        amount,
        checkoutRequestId: result.CheckoutRequestID,
        status: 'PENDING'
    });
    
    res.json({ success: true, checkoutId: result.CheckoutRequestID });
});

// 2. M-Pesa confirms payment (Callback)
app.post('/api/mpesa/stk-callback', async (req, res) => {
    const callback = req.body.Body.stkCallback;
    
    if (callback.ResultCode === 0) {
        // Payment successful
        const metadata = callback.CallbackMetadata.Item;
        const receipt = metadata.find(i => i.Name === 'MpesaReceiptNumber').Value;
        const paidAmount = metadata.find(i => i.Name === 'Amount').Value;
        
        // Find and update payment record
        const payment = await db.payment.findOne({
            where: { checkoutRequestId: callback.CheckoutRequestID }
        });
        
        if (payment) {
            payment.status = 'COMPLETED';
            payment.mpesaReceipt = receipt;
            payment.paidAt = new Date();
            await payment.save();
            
            // Update tenant's rent balance
            const tenant = await db.tenant.findById(payment.tenantId);
            tenant.balance -= paidAmount;
            await tenant.save();
            
            // Send confirmation SMS
            await sendSMS(tenant.phone, 
                `Rent payment of KSh ${paidAmount} received. Receipt: ${receipt}. Thank you!`
            );
        }
    }
    
    res.json({ success: true });
});

// 3. Check payment status
app.get('/api/payment/:checkoutRequestId/status', async (req, res) => {
    const { checkoutRequestId } = req.params;
    
    const result = await mpesa.querySTKStatus(checkoutRequestId);
    
    res.json({
        status: result.ResultCode === 0 ? 'SUCCESS' : 'FAILED',
        result: result
    });
});
```

---

## Fees & Charges

| Transaction Type | Fee (Approximate) |
|-------------------|-------------------|
| STK Push (send to business) | Free (received) |
| Withdraw to Bank (B2C) | KSh 200-400 depending on amount |
| Paybill Payment | Free (received) |
| Till Number Payment | Free (received) |
| M-Pesa to M-Pesa | Varies |

---

## Recommended Setup for Maximum Earnings

1. **Get a Paybill Number** - Best for rent collection
   - Tenants can pay from any bank app
   - Automatic reconciliation
   - Professional appearance

2. **Get a Till Number** - As backup
   - For cash payments at your office

3. **Set up B2C (Optional)** - If you need to pay tenants/agents
   - Requires additional Safaricom approval

4. **Bank Settlement** - Ensure your M-Pesa is linked to your bank
   - Regular withdrawals to cover expenses

---

## License & Usage

This M-Pesa integration is provided as part of RentFlow Pro. Ensure you comply with:
- Safaricom's Terms of Service
- M-Pesa API usage guidelines
- Kenya's financial regulations for payment processing
