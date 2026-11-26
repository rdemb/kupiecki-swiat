# Security Specification — Phase 0: Payload-First Security TDD

## 1. Data Invariants

1. **Master Gate & Relational Ownership**:
   - Every `/players/{playerId}` document belongs strictly to `request.auth.uid == playerId`.
   - Every `/players/{playerId}/trades/{tradeId}` document can only be created or read if the parent `/players/{playerId}` document exists and its `uid` matches `request.auth.uid`.
2. **Verified Identity**:
   - All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Zero PII & Strict Blueprint Keys**:
   - No PII (`email`, `phone`, `address`) is stored in `/players/{playerId}`.
   - Document creation requires exact key parity (`hasAll` and `hasOnly`), and updates require `isValidPlayerProfile(incoming())`, immutable `uid` and `createdAt`, server timestamp `incoming().updatedAt == request.time`, and explicit `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Payloads (All Must Return `PERMISSION_DENIED`)

1. **Unauthenticated Write**: `auth = null`, creating `/players/user_1`.
2. **Unverified Email Spoof**: `auth.uid = 'user_1'`, `email_verified = false`, creating `/players/user_1`.
3. **Identity Spoofing (`uid` mismatch)**: `auth.uid = 'user_1'`, writing `/players/user_2` or setting `incoming().uid = 'user_2'`.
4. **Shadow Field Injection**: Adding `isAdmin: true` or `vip: true` to `/players/user_1`.
5. **Resource Poisoning (Oversized ID / String)**: `displayName` with 5000 characters or `guildId` failing regex `^[a-zA-Z0-9_\-]+$`.
6. **Invalid Enum Value**: Setting `raceId: 'smoki_chaos'` outside `['ludzie', 'krasnoludy', 'elfy', 'gobliny', 'orkowie']`.
7. **Negative Gold / Inventory Tampering**: Setting `gold: -500` or `inv_mithril: -10`.
8. **Timestamp Forgery on Create**: Setting `createdAt` to a past/future client timestamp instead of `request.time`.
9. **Immutable Field Mutation on Update**: Changing `createdAt` or `uid` during an update on `/players/user_1`.
10. **Value Poisoning on Update**: Updating allowed key `gold` with a string `"999999"` instead of a valid non-negative number.
11. **Orphaned Subcollection Write**: Creating `/players/user_1/trades/t_1` when parent `/players/user_1` does not exist.
12. **Cross-Tenant Subcollection Read/List**: User `user_2` attempting to read or list `/players/user_1/trades`.
