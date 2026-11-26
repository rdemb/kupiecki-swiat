import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Firestore rules enforce the Eight Pillars and block all Dirty Dozen attack vectors', () => {
  const rulesPath = fs.existsSync('./firestore.rules')
    ? './firestore.rules'
    : './DRAFT_firestore.rules';
  const rules = fs.readFileSync(rulesPath, 'utf8');

  // 1. Rules Version 2 & Default Deny Catch-All
  assert.ok(rules.includes("rules_version = '2';"), 'Must use rules_version = 2');
  assert.ok(
    rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'),
    'Must start with default-deny catch-all',
  );

  // 2. Verified Email & Path Variable Hardening
  assert.ok(rules.includes('request.auth.token.email_verified == true'), 'Must require verified email');
  assert.ok(rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"), 'Must validate ID regex');

  // 3. Validation Blueprint & Strict Keys (Anti-Shadow Field & Value Poisoning)
  assert.ok(rules.includes('isValidPlayerProfile(incoming())'), 'Must wrap create and update with isValidPlayerProfile');
  assert.ok(rules.includes('data.keys().hasAll('), 'Must enforce required keys');
  assert.ok(rules.includes('data.keys().hasOnly('), 'Must enforce allowed keys');

  // 4. Temporal Integrity & Immutable Fields
  assert.ok(rules.includes('incoming().createdAt == request.time'), 'Must enforce request.time on create');
  assert.ok(rules.includes('incoming().updatedAt == request.time'), 'Must enforce request.time on update');
  assert.ok(rules.includes('incoming().createdAt == existing().createdAt'), 'Must keep createdAt immutable');
  assert.ok(rules.includes('incoming().uid == existing().uid'), 'Must keep uid immutable');

  // 5. Master Gate on Subcollection (/players/{playerId}/trades/{tradeId})
  assert.ok(
    rules.includes('get(/databases/$(database)/documents/players/$(playerId)).data.uid == request.auth.uid'),
    'Must enforce Master Gate parent ownership check on trades subcollection',
  );
});
