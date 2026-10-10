# Security Spec - Lockdown Produtora Firestore Hardening

## 1. Data Invariants

- **Store Orders**: Orders are created during checkout. Only the buyer, the seller (product owner), or an Admin can read the order details. Client-side updates or deletions are restricted to Admins.
- **Sellers Credentials**: Credentials contain private integration details and keys. Only the seller themselves or an Admin can read/write.
- **Tickets Issued**: Issued tickets represent event entries. Only the buyer, the show organizer, or an Admin can read them. No client-side updates or deletions are permitted except by Admins.
- **Notifications**: Notifications are personal and private. Only the recipient or an Admin can read/update them.
- **Wallets & Transactions**: Highly sensitive financial states. Standard users are restricted to read-only access to their own wallets/transactions. Frontend writes are blocked; only Admins (or the secure Backend Web SDK fallback logged in as `server-admin@lockdownprodutora.com.br`) can execute writes.

## 2. The "Dirty Dozen" Threat Vector Payloads

1. **Order Theft Attack**: Malicious user attempts to read another user's order in `/store_orders/{orderId}`.
2. **Order Spoofing Attack**: Guest user tries to update or delete another user's order.
3. **Credential Extraction**: User attempts to read secret Stripe/Mercado Pago credentials of a seller in `/sellers_credentials/{sellerId}`.
4. **Credential Hijacking**: Malicious actor tries to set credentials for another seller.
5. **Ticket Forgery**: Malicious user tries to create/update a ticket in `/tickets_issued/{ticketId}` with `status: "approved"` without paying.
6. **Ticket Scraping**: Non-owner tries to read issued tickets of an event.
7. **Notification Hijacking**: User attempts to read notifications sent to another user.
8. **Notification Spam**: User attempts to write arbitrary notifications to the entire collection.
9. **Wallet Credit Inject**: User attempts to update their balance in `/wallets/{userId}`.
10. **Wallet Drain Attack**: User attempts to write a negative-amount transaction log to `/wallet_transactions/{transactionId}`.
11. **Admin Promotion Spoof**: Non-admin attempts to promote themselves or write to `/admins/{adminId}`.
12. **Unauthorized User Modification**: User attempts to update another user's profile role or `isAdmin` flag in `/users/{userId}`.

## 3. Rules Deployment and Validation Action Plan

We will replace the wide-open `allow read, write: if true` clauses with explicit role-based constraints. 
The backend Web SDK fallback client authenticates with a `lockdownprodutora.com.br` domain, which resolves to `isAdmin() === true`, allowing it full operational capability under security rules.
