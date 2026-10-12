import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPaymentModeToDb, mapDbToPaymentMode } from '../src/services/api';

test('mapPaymentModeToDb correctly maps frontend display labels to live database check constraint literals', () => {
  // Test expected frontend labels to database constraint values
  assert.equal(mapPaymentModeToDb('Cash'), 'cash');
  assert.equal(mapPaymentModeToDb('UPI'), 'upi');
  assert.equal(mapPaymentModeToDb('Bank Transfer'), 'bank_transfer');
  assert.equal(mapPaymentModeToDb('Credit Card'), 'card');
  assert.equal(mapPaymentModeToDb('Cheque'), 'cheque');

  // Test case-insensitivity and variations
  assert.equal(mapPaymentModeToDb('bank_transfer'), 'bank_transfer');
  assert.equal(mapPaymentModeToDb('credit_card'), 'card');
  assert.equal(mapPaymentModeToDb('card'), 'card');
  assert.equal(mapPaymentModeToDb('Other'), 'other');
  assert.equal(mapPaymentModeToDb(null), 'bank_transfer');
  assert.equal(mapPaymentModeToDb(undefined), 'bank_transfer');
});

test('mapDbToPaymentMode correctly maps database values to frontend display labels', () => {
  assert.equal(mapDbToPaymentMode('cash'), 'Cash');
  assert.equal(mapDbToPaymentMode('upi'), 'UPI');
  assert.equal(mapDbToPaymentMode('bank_transfer'), 'Bank Transfer');
  assert.equal(mapDbToPaymentMode('card'), 'Credit Card');
  assert.equal(mapDbToPaymentMode('cheque'), 'Cheque');

  // Fallbacks
  assert.equal(mapDbToPaymentMode(null), 'Bank Transfer');
  assert.equal(mapDbToPaymentMode(undefined), 'Bank Transfer');
  assert.equal(mapDbToPaymentMode('unknown_mode'), 'Bank Transfer');
});
