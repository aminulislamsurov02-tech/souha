# Security Specification - Remix: Southa

## Data Invariants
1. **Products**: Must be managed strictly by admins. Every product must have a name, price, category, and valid image URL.
2. **Orders**: Can be created by any signed-in user. Must link to a valid product ID. Status can only be changed by admins.
3. **Support Tickets**: Can be created by any signed-in user. Status can only be changed by admins.
4. **Settings**: Publicly readable (social links) but only writable by admins.
5. **Admins**: This collection acts as the source of truth for administrative roles.

## The Dirty Dozen Payloads (Target: DENY)

1. **Identity Spoofing (Order)**: User A tries to create an order on behalf of User B.
   - Payload: `{ "customerEmail": "victim@example.com", "productId": "p1", ... }` (where victim != auth.token.email)
2. **Privilege Escalation (Admin)**: A regular user tries to add themselves to the `admins` collection.
   - Path: `/admins/non-admin-uid`
   - Payload: `{ "email": "attacker@example.com", "role": "admin" }`
3. **State Shortcutting (Order)**: A user tries to create an order already in 'delivered' status.
   - Payload: `{ "status": "delivered", ... }`
4. **Shadow Field Injection**: A user tries to add a "discount" field to an order that isn't in the schema.
   - Payload: `{ "status": "pending", "discount": 100, ... }`
5. **ID Poisoning**: A user tries to create a product with an excessively long or malicious ID.
   - Path: `/products/LONG_MALICIOUS_ID...`
6. **Immutable Field Violation**: An admin tries to change the `createdAt` timestamp of a product.
   - Payload: `{ "createdAt": "2000-01-01T00:00:00Z", ... }`
7. **Type Mismatch**: A user sends a number for the `productName` field.
   - Payload: `{ "productName": 123, ... }`
8. **Denial of Wallet (Huge String)**: A user sends a 1MB string for the support ticket message.
9. **Unverified Email WRITE**: A user with an unverified email tries to submit a support ticket.
10. **Global Write**: A user tries to write to the root of the database or a non-existent collection.
11. **Update Gap**: An admin tries to update the product field `hiddenField` which shouldn't exist.
12. **PII Leak**: An unauthorized user tries to list all documents in the `orders` collection to scrape customer emails.

## Test Runner Logic
The `firestore.rules` must ensure that all the above scenarios result in `PERMISSION_DENIED`.
