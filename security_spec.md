# Security Specification for Faciw

## Data Invariants
1. **Relational Integrity**: A `Product` must belong to a valid `Merchant`. Creation of a product requires verification that the `merchantId` exists and is owned by the requester.
2. **Identity Isolation**: User data (`chat_sessions`, `shopping_list`, `settings`) is strictly scoped to the `userId` in the path. No cross-user access allowed.
3. **Immutable Ownership**: The `ownerId` of a `Merchant` and the `merchantId` of a `Product` are immutable after creation.
4. **Type Safety**: All fields must strictly adhere to their defined types (string, number, boolean, list, map) and size constraints.
5. **Temporal Integrity**: `createdAt` and `updatedAt` fields must be validated against `request.time`.

## The "Dirty Dozen" Payloads

1. **Identity Hijack**: Update `merchants/{mId}` with `{ "ownerId": "hacker_uid" }`.
2. **Orphaned Product**: Create `products/{pId}` with a `merchantId` that does not exist.
3. **Cross-Tenant Write**: Create `products/{pId}` using a `merchantId` owned by another user.
4. **Price Poisoning**: Update `products/{pId}` with `{ "price": -100 }`.
5. **Session Snoop**: Read `users/victim_uid/chat_sessions/session_abc`.
6. **List Scrape**: Attempt to list all documents in `users/{userId}/chat_sessions` without being the owner.
7. **Resource Exhaustion**: Create a product with a `name` longer than 150 characters or a 1MB string.
8. **Privilege Escalation**: Update `merchants/{mId}` with `{ "plan": "premium", "isSubscribed": true }` as a regular merchant owner.
9. **Timestamp Fraud**: Create a session with `{ "createdAt": 1999999999999 }` (far future).
10. **Schema Pollution**: Update a product with `{ "isVerified": true, "hiddenDiscount": 90 }`.
11. **ID Injection**: Create a merchant with a document ID containing malicious characters or exceeding 128 bytes.
12. **Unauthorized Deletion**: Delete a product belonging to a merchant you do not own.

## Test Strategy (Phase 1)
Tests will be implemented using the `@firebase/rules-unit-testing` framework.

- `test('unauthenticated users cannot write', ...)`
- `test('users cannot read others sessions', ...)`
- `test('merchants cannot change their plan', ...)`
- `test('immutability of merchantId in products', ...)`
