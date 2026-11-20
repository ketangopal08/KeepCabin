# Razorpay Test Mode — paying for a KeepCabin plan

How to complete a **test** subscription payment (Upgrade page or onboarding "Choose your plan").
These are **fake test values**: they only work while the dashboard is in **Test Mode** and the
app uses `rzp_test_…` keys. No real money moves. Never use real bank or card details here.

---

## Option A: eMandate (bank account), the method that worked for this account

Card payments failed on this Razorpay account (see "Known issues" below), so use eMandate.

1. In Razorpay Checkout, open the **EMandate** tab (left side, under *Cards*).
2. Fill in the bank details with **dummy values**. Test Mode only checks the *format*:

   | Field | Test value |
   |---|---|
   | Bank | **Axis Bank** (any listed bank works) |
   | Account number | `1111111111111` (any digits) |
   | IFSC | `UTIB0000001` (any IFSC in the right format for the chosen bank: 4 letters + `0` + 6 characters) |
   | Account holder name | any name, e.g. `Test User` |
   | Account type | Savings |

3. **Authenticate using → Netbanking.**
4. On Razorpay's **mock bank page**, click **Success**. Click **Failure** instead to test a failed payment.
5. Checkout closes, and the plan changes to **Pro / Business** within a few seconds. The invoice
   appears in **Settings → Billing**.

> Test Mode never opens a real bank login page. It always shows Razorpay's mock Success / Failure page.

---

## Option B: Cards (recurring-enabled test cards)

Only these test cards support subscriptions (recurring):

| Card | Network / type | Number |
|---|---|---|
| Domestic | Visa · Credit | `4718 6091 0820 4366` |
| International | Mastercard · Credit | `5104 0155 5555 5558` |
| International | Mastercard · Debit | `5104 0600 0000 0008` |

- **Expiry:** any future date (e.g. `12/30`) · **CVV:** any 3 digits · **Name:** anything
- **OTP:** any 4–10 digits for **success**. Fewer than 4 digits makes the payment **fail**.
- Test card tokens are valid for **3 days**, so a test "renewal" more than 3 days later can fail.
  That's a Test Mode limit, not an app bug.

Don't use `4111 1111 1111 1111`. It isn't enabled for recurring payments, and fails with
"This card is not eligible for recurring payments".

---

## Known issues seen on this account (Nov 2026)

| What we tried | Result | Why |
|---|---|---|
| `4111 1111 1111 1111` | "Not eligible for recurring payments" | Not a recurring test card |
| `4718 6091 0820 4366` (Visa, domestic) | `SERVER_ERROR` | Razorpay-side; possibly recurring cards not enabled on the account |
| `5104 0155 5555 5558` (Mastercard) | "International cards are not supported" | International cards are disabled on the account |
| **eMandate (Axis, Netbanking → Success)** | **✅ Worked** | |

To use cards, ask Razorpay support to enable **recurring card payments** (and international
cards if needed) for the account in Test Mode.

---

## Going live

1. Complete KYC/activation in the Razorpay dashboard and switch to **Live Mode**.
2. Create the same 4 plans (Pro/Business × monthly/yearly). Amounts include 18% GST:
   Pro ₹1,768.82 / ₹17,688.20 · Business ₹4,718.82 / ₹47,188.20.
3. Replace `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and the four `RAZORPAY_PLAN_*` values
   (in `.env` and in Vercel) with the live ones, and register the live webhook
   (`https://<domain>/api/billing/webhook`, events `subscription.*` + `payment.failed`).

Sources: [Razorpay test card details](https://razorpay.com/docs/payments/payments/test-card-details/) ·
[Razorpay eMandate FAQs](https://razorpay.com/docs/payments/recurring-payments/emandate/faqs) ·
[Razorpay test integration (mock bank page)](https://razorpay.com/docs/payments/payment-gateway/web-integration/custom/test-integration.md)
