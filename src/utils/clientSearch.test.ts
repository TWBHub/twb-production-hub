import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchesClientSearch, safeNormalizeString } from './clientUtils';
import { Client } from '../types';

describe('clientUtils — Null-Safe Client Search', () => {
  const sampleClients: Client[] = [
    {
      id: 'client-1',
      company_id: 'twb',
      name: 'Sophia Laurent',
      partner_name: 'Liam Vance',
      email: 'sophia@example.com',
      phone: '+1 (555) 019-2834',
      instagram: '@sophialaurent',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'client-2',
      company_id: 'golden_june',
      name: 'Lead Test Client',
      partner_name: 'Marcus Brody',
      // Note: email is null/undefined in database for some test records
      email: null as any,
      phone: '9876543210',
      created_at: '2026-01-02T00:00:00Z',
    },
    {
      id: 'client-3',
      company_id: 'twb',
      name: 'Camilla Dupont',
      partner_name: null as any,
      email: 'camilla@dupontfilms.com',
      phone: null as any,
      notes: 'Destination vineyard wedding celebration',
      created_at: '2026-01-03T00:00:00Z',
    },
    {
      id: 'client-4',
      company_id: 'twb',
      // Completely null/missing optional attributes
      name: null as any,
      partner_name: null as any,
      email: null as any,
      phone: null as any,
      instagram: null as any,
      instagram_2: null as any,
      notes: null as any,
      created_at: '2026-01-04T00:00:00Z',
    },
  ];

  it('safeNormalizeString handles null, undefined, empty, and non-strings safely', () => {
    assert.equal(safeNormalizeString(null), '');
    assert.equal(safeNormalizeString(undefined), '');
    assert.equal(safeNormalizeString(''), '');
    assert.equal(safeNormalizeString('   '), '');
    assert.equal(safeNormalizeString('  HELLO  '), 'hello');
    assert.equal(safeNormalizeString(123), '123');
  });

  it('Case 1: Search for "Q" when no client matches (must not crash on null email)', () => {
    // This previously crashed with TypeError: Cannot read properties of null (reading 'toLowerCase')
    assert.doesNotThrow(() => {
      const results = sampleClients.filter(c => matchesClientSearch(c, 'Q'));
      assert.equal(results.length, 0);
    });
  });

  it('Case 2: Search for "Lead Test" correctly matches the lead test client', () => {
    const results = sampleClients.filter(c => matchesClientSearch(c, 'Lead Test'));
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'client-2');
  });

  it('Case 3: Search using a single character works without crashing on null records', () => {
    assert.doesNotThrow(() => {
      // 's' matches 'Sophia Laurent', 'Lead Test Client' (via Marcus), etc.
      const resultsS = sampleClients.filter(c => matchesClientSearch(c, 's'));
      assert.ok(resultsS.length > 0);

      // 'z' matches none without throwing
      const resultsZ = sampleClients.filter(c => matchesClientSearch(c, 'z'));
      assert.equal(resultsZ.length, 0);
    });
  });

  it('Case 4: Search for a name that partially matches an existing client', () => {
    const results = sampleClients.filter(c => matchesClientSearch(c, 'soph'));
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'client-1');

    const partnerResults = sampleClients.filter(c => matchesClientSearch(c, 'marcus'));
    assert.equal(partnerResults.length, 1);
    assert.equal(partnerResults[0].id, 'client-2');
  });

  it('Case 5: Search for a non-existent name returns empty array without throwing', () => {
    assert.doesNotThrow(() => {
      const results = sampleClients.filter(c => matchesClientSearch(c, 'NonExistentName123'));
      assert.equal(results.length, 0);
    });
  });

  it('Case 6: Search using an email address matches accurately despite null emails', () => {
    const results = sampleClients.filter(c => matchesClientSearch(c, 'dupontfilms.com'));
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'client-3');

    const exactResults = sampleClients.filter(c => matchesClientSearch(c, 'sophia@example.com'));
    assert.equal(exactResults.length, 1);
    assert.equal(exactResults[0].id, 'client-1');
  });

  it('Case 7: Search using a phone number (both formatted and digits)', () => {
    // Formatted query
    const results1 = sampleClients.filter(c => matchesClientSearch(c, '+1 (555) 019'));
    assert.equal(results1.length, 1);
    assert.equal(results1[0].id, 'client-1');

    // Clean digits query
    const results2 = sampleClients.filter(c => matchesClientSearch(c, '5550192834'));
    assert.equal(results2.length, 1);
    assert.equal(results2[0].id, 'client-1');

    // Indian phone number
    const results3 = sampleClients.filter(c => matchesClientSearch(c, '9876543210'));
    assert.equal(results3.length, 1);
    assert.equal(results3[0].id, 'client-2');
  });

  it('Case 8: Search when client records have completely null fields never crashes', () => {
    assert.doesNotThrow(() => {
      // Client 4 has all fields null
      const result = matchesClientSearch(sampleClients[3], 'random search');
      assert.equal(result, false);
    });
  });

  it('Case 9: Clear the search field after performing a search (empty/blank returns all)', () => {
    assert.equal(sampleClients.filter(c => matchesClientSearch(c, '')).length, 4);
    assert.equal(sampleClients.filter(c => matchesClientSearch(c, '   ')).length, 4);
    assert.equal(sampleClients.filter(c => matchesClientSearch(c, null)).length, 4);
    assert.equal(sampleClients.filter(c => matchesClientSearch(c, undefined)).length, 4);
  });

  it('Case 10: Null or undefined client parameter returns false gracefully', () => {
    assert.equal(matchesClientSearch(null, 'test'), false);
    assert.equal(matchesClientSearch(undefined, 'test'), false);
  });
});
