# Security Specification & Threat Model

## 1. Data Invariants
- Users can only read and write their own profile document (`/users/{userId}`).
- API Keys can only be created, read, or deleted by the user whose UID matches `request.auth.uid`.
- Verification records are append-only audit entries. Clients can create a record associated with their UID or view records belonging to their UID.
- No client may elevate privileges, spoof an ownerId, or perform updates that bypass field validation.

## 2. The Dirty Dozen Payloads
1. Spoofed ownerId on UserApiKey creation (auth.uid = "user_A", payload.ownerId = "user_B") -> DENIED.
2. Malformed keyId containing path traversal or regex injection -> DENIED.
3. Oversized string payload (> 500 chars in key name) -> DENIED.
4. Unauthenticated read of private `/api_keys` collection -> DENIED.
5. Cross-user reading of another user's `/users/{userId}` profile -> DENIED.
6. User profile modification setting an unverified email or fake role -> DENIED.
7. Verification record modification attempting to retroactively alter `status` from DUPLICATE_CLAIM to VERIFIED -> DENIED.
8. Deletion of another user's API key -> DENIED.
9. Injection of unexpected "Ghost Fields" (e.g. `isAdmin: true`) into UserProfile -> DENIED.
10. Unbounded list query without matching security constraint (`allow list` evaluation) -> DENIED.
11. Verification record with negative or infinite amount -> DENIED.
12. Attempt to write to arbitrary unspecified Firestore collections -> DENIED by default catch-all rule.
