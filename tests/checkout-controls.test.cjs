const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../cart.html'), 'utf8');
function functions() {
  return source.slice(source.indexOf('    function setCheckoutBusy('), source.indexOf('    async function refreshCartBeforeCheckout('));
}
test('checkout locks editable controls and restores the cart limit gate', () => {
  const controls = [{ disabled: false }, { disabled: false }];
  const button = {};
  const context = vm.createContext({ document: { querySelectorAll: () => controls }, checkoutButton: button, currentUser: {}, cart: [1], cartQuantity: () => 15, checkoutInProgress: false });
  vm.runInContext(functions(), context);
  context.setCheckoutBusy(true, '訂單建立中⋯');
  assert.ok(controls.every(control => control.disabled));
  assert.equal(button.disabled, true);
  assert.equal(context.checkoutInProgress, true);
  context.cartQuantity = () => 16;
  context.setCheckoutBusy(false);
  assert.ok(controls.every(control => !control.disabled));
  assert.equal(button.disabled, true);
  context.cartQuantity = () => 15;
  context.setCheckoutBusy(false);
  assert.equal(button.disabled, false);
});
test('chat opens immediately and copying failure gives the actual order text', async () => {
  const opened = [], prompts = [], alerts = [];
  const context = vm.createContext({ navigator: { clipboard: { writeText: () => Promise.reject(new Error('denied')) } }, window: { open: (...args) => opened.push(args), prompt: (...args) => prompts.push(args), alert: text => alerts.push(text) } });
  vm.runInContext(functions(), context);
  context.openOrderChat('https://ig.me/m/colormix637', 'CMTEST', 'Instagram');
  assert.equal(opened.length, 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(alerts.length, 0);
  assert.match(prompts[0][1], /CMTEST/);
  context.navigator.clipboard = undefined;
  context.openOrderChat('https://ig.me/m/colormix637', 'CMTEST2', 'Instagram');
  assert.equal(opened.length, 2);
  assert.match(prompts[1][1], /CMTEST2/);
});
test('quantity and removal cannot change the cart during checkout', () => {
  const context = vm.createContext({ checkoutInProgress: true, cart: [{ quantity: 2 }], cartQuantity: () => 2 });
  const start = source.indexOf('    function changeQuantity(');
  const end = source.indexOf('    function setCheckoutBusy(', start);
  vm.runInContext(source.slice(start, end), context);
  context.changeQuantity(0, 1);
  context.removeItem(0);
  assert.equal(context.cart.length, 1);
  assert.equal(context.cart[0].quantity, 2);
});
