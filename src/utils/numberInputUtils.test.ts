import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeNumericInput, parseNumericInput } from './numberInputUtils';

describe('numberInputUtils', () => {
  describe('sanitizeNumericInput', () => {
    it('returns empty string for null, undefined, and empty string', () => {
      assert.equal(sanitizeNumericInput(null), '');
      assert.equal(sanitizeNumericInput(undefined), '');
      assert.equal(sanitizeNumericInput(''), '');
      assert.equal(sanitizeNumericInput('   '), '');
    });

    it('strips leading zeros when typing new amounts (e.g. 020000 -> 20000)', () => {
      assert.equal(sanitizeNumericInput('020000'), '20000');
      assert.equal(sanitizeNumericInput('00500'), '500');
      assert.equal(sanitizeNumericInput('01'), '1');
      assert.equal(sanitizeNumericInput('0999999'), '999999');
    });

    it('preserves a single zero when user enters 0', () => {
      assert.equal(sanitizeNumericInput('0'), '0');
      assert.equal(sanitizeNumericInput(0), '0');
      assert.equal(sanitizeNumericInput('000'), '0');
    });

    it('preserves decimal numbers and zero prefixes before decimals', () => {
      assert.equal(sanitizeNumericInput('0.'), '0.');
      assert.equal(sanitizeNumericInput('0.5'), '0.5');
      assert.equal(sanitizeNumericInput('0.05'), '0.05');
      assert.equal(sanitizeNumericInput('00.5'), '0.5');
      assert.equal(sanitizeNumericInput('1500.50'), '1500.50');
    });

    it('filters out non-numeric characters', () => {
      assert.equal(sanitizeNumericInput('abc'), '');
      assert.equal(sanitizeNumericInput('₹50,000'), '50000');
      assert.equal(sanitizeNumericInput('100a200'), '100200');
    });

    it('handles number inputs gracefully', () => {
      assert.equal(sanitizeNumericInput(5000), '5000');
      assert.equal(sanitizeNumericInput(0), '0');
    });
  });

  describe('parseNumericInput', () => {
    it('parses strings and numbers correctly', () => {
      assert.equal(parseNumericInput('20000'), 20000);
      assert.equal(parseNumericInput('0'), 0);
      assert.equal(parseNumericInput(15000), 15000);
      assert.equal(parseNumericInput('1500.75'), 1500.75);
    });

    it('returns fallback for empty or invalid inputs', () => {
      assert.equal(parseNumericInput(''), 0);
      assert.equal(parseNumericInput('', 100), 100);
      assert.equal(parseNumericInput(null), 0);
      assert.equal(parseNumericInput(undefined), 0);
      assert.equal(parseNumericInput('invalid', 50), 50);
    });
  });
});
