'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', '..', 'ava-platform', 'modules', 'tech-platform', 'techControlPlane.js');
const source = fs.readFileSync(sourcePath, 'utf8');

test('nomor tiket support tetap unik pada tiket yang dibuat di detik yang sama', async () => {
  const fixedNow = 1791313639000;
  const submitted = [];
  const messages = [];
  let random = 0.11;
  const values = {
    'tcp-ticket-title': { value: 'Synthetic issue' },
    'tcp-ticket-description': { value: 'Synthetic details' },
    'tcp-ticket-tenant': { value: '' },
    'tcp-ticket-priority': { value: 'P2' },
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    static now() { return fixedNow; }
  }
  const math = Object.create(Math);
  math.random = () => {
    const value = random;
    random += 0.11;
    return value;
  };
  const context = {
    Date: FixedDate,
    Math: math,
    document: { getElementById: id => values[id] || null },
    sbPost: async (table, payload) => {
      submitted.push({ table, payload });
      return [{ id: submitted.length }];
    },
    toast: (message, type) => messages.push({ message, type }),
    console,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: sourcePath });
  context.renderTechControlPlane = async () => {};

  await context.tcpBuatTiket();
  await context.tcpBuatTiket();

  assert.equal(submitted.length, 2);
  assert.equal(submitted[0].table, 'tech_support_tickets');
  assert.notEqual(submitted[0].payload.ticket_no, submitted[1].payload.ticket_no);
  assert.equal(submitted[0].payload.ticket_no, submitted[0].payload.correlation_id);
  assert.equal(submitted[1].payload.ticket_no, submitted[1].payload.correlation_id);
  assert.equal(messages.filter(message => message.type === 'ok').length, 2);
});
