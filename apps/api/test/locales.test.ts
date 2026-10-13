import assert from 'node:assert/strict';
import { test } from 'node:test';
import { es } from '../../web/app/locales/es';
import { en } from '../../web/app/locales/en';

test('Spanish and English dictionaries cover identical stable keys and placeholders', () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  for (const key of Object.keys(es) as Array<keyof typeof es>) {
    assert.ok(es[key].length && en[key].length);
    assert.deepEqual(es[key].match(/\{\w+\}/g)?.sort(), en[key].match(/\{\w+\}/g)?.sort());
  }
});
