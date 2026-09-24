'use strict';
// tagger-clipboard.js tests: detail page and grid scanning on Scryfall Tagger.
const {
  assert, assertEqual, summary, sleep, createPage, click, fireEvent,
  dataTransferObject, waitFor
} = require('./testlib.cjs');

function loadPage(options) {
  const page = createPage(options);
  page.script('i18n.js');
  page.script('tagger-clipboard.js');
  return page;
}

async function detailPageTest() {
  console.log('tagger-clipboard.js: detail page');
  const page = loadPage({
    url: 'https://tagger.scryfall.com/card/tst/1/test-card',
    html: `<!DOCTYPE html><html><body><main>
      <div class="card-layout">
        <div class="card-image"><img src="https://example/img.png" alt=""></div>
      </div>
      <h1>Test Card <span class="set-badge">TST</span></h1>
    </main></body></html>`,
    state: { cards: [] }
  });
  await sleep(60);
  const { document, mock, location } = page;

  const aside = document.getElementById('scryfall-toolkit-clipboard');
  assert(aside, 'clipboard aside injected on Tagger');
  assertEqual(aside.querySelectorAll('.stk-toolbar > button').length, 3,
    'toolbar has copy, clear and open buttons');
  const list = aside.querySelector('.stk-list');
  assert(list.hidden, 'card list starts hidden');
  assertEqual(aside.querySelector('.stk-count').textContent, '0', 'badge starts at zero');
  assert(aside.querySelector('.stk-count').hidden, 'empty badge is hidden');

  const addButton = document.querySelector('.card-image .stk-add');
  assert(addButton, 'detail page gets an add button on the card image');
  assertEqual(addButton.textContent, '+', 'card starts unselected');
  assertEqual(addButton.getAttribute('aria-label'), 'Add Test Card', 'label names the card');

  click(addButton);
  await waitFor(() => mock.state.cards.length === 1, 'card added through detail button');
  assertEqual(mock.state.cards[0], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/1', set: 'tst', number: '1'
  }, 'card saved with canonical URL, set and number');
  assertEqual(addButton.textContent, '✓', 'button shows selected state');
  assertEqual(addButton.getAttribute('aria-label'), 'Remove Test Card', 'label flips to remove');
  assert(addButton.classList.contains('stk-selected'), 'selected class applied');
  assertEqual(aside.querySelector('.stk-count').textContent, '1', 'badge counts the card');
  assert(!aside.querySelector('.stk-count').hidden, 'badge is visible');

  // Open the list and inspect the row.
  click(aside.querySelector('.stk-icon-clip'));
  assert(!list.hidden, 'clip button reveals the list');
  const row = document.querySelector('.stk-list-row');
  assert(row, 'list row rendered');
  assertEqual(row.querySelector('a').textContent, 'Test Card', 'row links the card name');
  assertEqual(row.querySelector('a').getAttribute('href'), 'https://scryfall.com/card/tst/1',
    'row link uses the canonical URL');
  assertEqual(row.querySelector('.stk-copy-card').getAttribute('aria-label'), 'Copy card Test Card',
    'row copy button labeled');

  // Row copy honors the export format.
  click(row.querySelector('.stk-copy-card'));
  await waitFor(() => mock.clipboardWrites.length === 1, 'row copy wrote to clipboard');
  assertEqual(mock.clipboardWrites[0], '1 Test Card', 'names format copies names only');

  // Toolbar copy-all.
  click(aside.querySelector('.stk-toolbar .stk-icon-duplicate'));
  await waitFor(() => mock.clipboardWrites.length === 2, 'toolbar copy wrote to clipboard');
  assertEqual(mock.clipboardWrites[1], '1 Test Card', 'toolbar copy-all formats every card');

  mock.state.exportFormat = 'moxfield';
  click(aside.querySelector('.stk-toolbar .stk-icon-duplicate'));
  await waitFor(() => mock.clipboardWrites.length === 3, 'moxfield copy wrote to clipboard');
  assertEqual(mock.clipboardWrites[2], '1 Test Card (TST) 1',
    'moxfield format appends set and number');

  // Remove the card through the row button.
  click(row.querySelector('button[aria-label="Remove Test Card"]'));
  await waitFor(() => mock.state.cards.length === 0, 'card removed from list');
  assert(aside.querySelector('.stk-count').hidden, 'badge hidden for empty clipboard');

  // Re-add and clear via the toolbar trash button.
  click(document.querySelector('.card-image .stk-add'));
  await waitFor(() => mock.state.cards.length === 1, 'card re-added');
  click(aside.querySelector('.stk-icon-trash'));
  await waitFor(() => mock.state.cards.length === 0, 'clipboard cleared');
  assertEqual(location.assigned.length, 0, 'clipboard interactions never navigate away');
}

async function externalUpdateTest() {
  console.log('tagger-clipboard.js: storage.onChanged sync');
  const page = loadPage({
    url: 'https://tagger.scryfall.com/card/tst/1/test-card',
    html: `<!DOCTYPE html><html><body><main>
      <div class="card-layout">
        <div class="card-image"><img src="https://example/img.png" alt=""></div>
      </div>
      <h1>Test Card</h1>
    </main></body></html>`,
    state: { cards: [] }
  });
  await sleep(60);
  const { document, mock } = page;

  const external = [{ name: 'Ext Card', url: 'https://scryfall.com/card/abc/1/ext', set: 'abc', number: '1' }];
  mock.state.cards = external;
  mock.fireChanges({ cards: { newValue: external } });
  await sleep(30);
  assertEqual(document.querySelector('.stk-count').textContent, '1',
    'external storage change updates the badge');
  const row = document.querySelector('.stk-list-row');
  assertEqual(row.querySelector('a').textContent, 'Ext Card', 'external change re-renders rows');
  assertEqual(document.querySelector('.card-image .stk-add').textContent, '+',
    'local card is no longer selected after external change');
}

async function gridPageTest() {
  console.log('tagger-clipboard.js: grid page');
  const page = loadPage({
    url: 'https://tagger.scryfall.com/tags/set/tst',
    html: `<!DOCTYPE html><html><body><main>
      <div class="card-grid-item"><a class="card" href="/card/grid/9"><img alt="Grid Card"></a></div>
      <div class="card-grid-item"><a class="card" href="/card/noimg/1"></a></div>
      <div class="card-grid-item"><a class="notcard" href="/card/x/1"><img alt="Should Not"></a></div>
    </main></body></html>`,
    state: { cards: [] }
  });
  await sleep(60);
  const { document, mock } = page;

  const addButtons = [...document.querySelectorAll('.card-grid-item .stk-add')];
  assertEqual(addButtons.length, 1, 'only valid grid items get add buttons');
  assert(addButtons[0].closest('.card-grid-item').querySelector('a.card'),
    'add button attached to a valid grid item');
  assert(!document.querySelector('a.notcard').closest('.card-grid-item').querySelector('.stk-add'),
    'items without a.card link are skipped');

  click(addButtons[0]);
  await waitFor(() => mock.state.cards.length === 1, 'grid card added');
  assertEqual(mock.state.cards[0], {
    name: 'Grid Card', url: 'https://scryfall.com/card/grid/9', set: 'grid', number: '9'
  }, 'grid card saved with canonical URL');

  click(addButtons[0]);
  await waitFor(() => mock.state.cards.length === 0, 'grid card toggled off');
}

async function disabledTest() {
  console.log('tagger-clipboard.js: clipboard disabled');
  const page = loadPage({
    url: 'https://tagger.scryfall.com/card/tst/1/test-card',
    html: `<!DOCTYPE html><html><body><main>
      <div class="card-layout">
        <div class="card-image"><img src="https://example/img.png" alt=""></div>
      </div>
      <h1>Test Card</h1>
    </main></body></html>`,
    state: { clipboard: false, cards: [] }
  });
  await sleep(60);
  const { document } = page;
  assert(!document.getElementById('scryfall-toolkit-clipboard'), 'no clipboard when disabled');
  assert(!document.querySelector('.stk-add'), 'no add buttons when disabled');
}

(async () => {
  try {
    await detailPageTest();
    await externalUpdateTest();
    await gridPageTest();
    await disabledTest();
    summary('test-tagger');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
