// Booking form: live estimated total + itemized email order.
// Prices live here only so they are not displayed on the page.

const EMAIL = 'hernandezcleanup.a@gmail.com';

const HOME_SIZES = {
  'studio': { label: 'Studio',          basic: 70,  deep: 90,  movein: 130, moveout: 150 },
  '1-1':    { label: '1 Bed / 1 Bath',  basic: 85,  deep: 150, movein: 170, moveout: 180 },
  '2-1':    { label: '2 Bed / 1 Bath',  basic: 99,  deep: 180, movein: 190, moveout: 220 },
  '2-2':    { label: '2 Bed / 2 Bath',  basic: 150, deep: 199, movein: 220, moveout: 250 },
  '3-1':    { label: '3 Bed / 1 Bath',  basic: 180, deep: 200, movein: 250, moveout: 275 },
  '3-2':    { label: '3 Bed / 2 Bath',  basic: 190, deep: 220, movein: 260, moveout: 285 },
  '4-1':    { label: '4 Bed / 1 Bath',  basic: 200, deep: 250, movein: 280, moveout: 290 },
  '4-2':    { label: '4 Bed / 2 Bath',  basic: 220, deep: 275, movein: 300, moveout: 375 },
  '4-3':    { label: '4 Bed / 3 Bath',  basic: 300, deep: 400, movein: 375, moveout: 420 }
};

const CLEAN_TYPES = {
  basic: 'Basic Cleaning',
  deep: 'Deep Cleaning',
  movein: 'Move-In Cleaning',
  moveout: 'Move-Out Cleaning'
};

// price: null means "call for quote"
const COMMERCIAL = {
  small:  { label: 'Small office / suite (up to 1,500 sq ft)', price: 110 },
  medium: { label: 'Medium office (1,500-3,000 sq ft)',        price: 180 },
  large:  { label: 'Large office (3,000-5,000 sq ft)',         price: 275 },
  xl:     { label: 'Over 5,000 sq ft',                          price: null }
};

const EXTRAS = {
  garage:       { label: 'Garage',                          price: 200 },
  office:       { label: 'Office room (varies by sq ft)',   price: 150 },
  storage:      { label: 'Storage room',                    price: 160 },
  windows:      { label: 'Window cleaning',                 price: 80 },
  tileFloors:   { label: 'Tile/grout floor cleaning',       price: 130 },
  bathGrout:    { label: 'Bathroom tile grout',             price: 99 },
  baseboards:   { label: 'Baseboards/crown molding',        price: 75 },
  fridge:       { label: 'Refrigerator cleaning',           price: 50 },
  oven:         { label: 'Oven cleaning',                   price: 75 },
  dishes:       { label: 'Washing dishes',                  price: 80 },
  kitchenBasic: { label: 'Kitchen basic cleaning',          price: 175 },
  kitchenDeep:  { label: 'Kitchen deep cleaning',           price: 199 }
};

const FREQUENCIES = {
  once:     { label: 'One-time cleaning',             discount: 0 },
  weekly:   { label: 'Recurring - Weekly',            discount: 0.15 },
  biweekly: { label: 'Recurring - Every 2 weeks',     discount: 0.10 },
  monthly:  { label: 'Recurring - Monthly',           discount: 0.05 }
};

const form = document.getElementById('order-form');
const $ = (id) => document.getElementById(id);
const money = (n) => '$' + n.toFixed(2).replace(/\.00$/, '');

// Collects the current selections into one order object.
function getOrder() {
  const data = new FormData(form);
  const isCommercial = data.get('propertyType') === 'commercial';
  const items = [];
  let needsQuote = false;

  if (isCommercial) {
    const size = COMMERCIAL[data.get('commercialSize')];
    items.push({ label: 'Commercial - ' + size.label, price: size.price });
    if (size.price === null) needsQuote = true;
  } else {
    const size = HOME_SIZES[data.get('homeSize')];
    const type = data.get('cleanType');
    items.push({ label: size.label + ' - ' + CLEAN_TYPES[type], price: size[type] });
  }

  const extras = data.getAll('extra').map((key) => EXTRAS[key]);
  extras.forEach((e) => items.push({ label: e.label, price: e.price }));

  const subtotal = items.reduce((sum, i) => sum + (i.price || 0), 0);
  const freq = FREQUENCIES[data.get('frequency')];
  const discount = Math.round(subtotal * freq.discount * 100) / 100;

  return {
    data, isCommercial, items, extras, freq, needsQuote,
    subtotal, discount, total: subtotal - discount
  };
}

// Move-in/out cleanings are one-time only, so lock frequency to "once".
function syncFrequency() {
  const type = $('cleanType').value;
  const oneTimeOnly = form.propertyType.value !== 'commercial' && (type === 'movein' || type === 'moveout');
  form.querySelectorAll('input[name="frequency"]').forEach((r) => {
    if (r.value !== 'once') r.disabled = oneTimeOnly;
  });
  if (oneTimeOnly) form.querySelector('input[name="frequency"][value="once"]').checked = true;
  $('freq-hint').hidden = !oneTimeOnly;
}

function syncPropertyType() {
  const isCommercial = form.propertyType.value === 'commercial';
  $('residential-fields').hidden = isCommercial;
  $('commercial-fields').hidden = !isCommercial;
}

function render() {
  syncPropertyType();
  syncFrequency();
  const o = getOrder();

  $('summary-service').textContent = o.items[0].label.replace(' - ', ' · ');
  $('summary-extras').textContent = o.extras.length
    ? o.extras.length + (o.extras.length === 1 ? ' extra' : ' extras') + ' added'
    : 'No extras';
  $('summary-freq').textContent = o.freq.discount
    ? o.freq.label.replace('Recurring - ', '') + ' (save ' + o.freq.discount * 100 + '%)'
    : o.freq.label;

  if (o.needsQuote) {
    $('total').textContent = o.total ? money(o.total) + ' +' : 'Custom quote';
    $('total-note').textContent = 'Large spaces are priced after a walkthrough';
  } else {
    $('total').textContent = money(o.total);
    $('total-note').textContent = o.freq.discount ? 'per visit, discount applied' : 'per visit';
  }
}

// Builds the plain-text email body with every item priced.
function buildEmail(o) {
  const d = o.data;
  const line = (label, value) => label + ': ' + (value || '-');
  const lines = [
    'NEW CLEANING ORDER',
    '',
    '--- Customer ---',
    line('Name', d.get('name')),
    line('Phone', d.get('phone')),
    line('Email', d.get('email')),
    line('Address', d.get('address')),
    line('City', d.get('city')),
    '',
    '--- Service ---',
    line('Property type', o.isCommercial ? 'Commercial' : 'Residential')
  ];
  if (o.isCommercial) lines.push(line('Business type', d.get('businessType')));
  lines.push(
    line('Frequency', o.freq.label),
    line('Preferred date', d.get('date')),
    line('Preferred time', d.get('time')),
    '',
    '--- Order ---'
  );
  o.items.forEach((i) => lines.push(i.label + ': ' + (i.price === null ? 'Call for quote' : money(i.price))));
  lines.push('', line('Subtotal', money(o.subtotal)));
  if (o.discount) lines.push(line('Recurring discount (' + o.freq.discount * 100 + '%)', '-' + money(o.discount)));
  lines.push(line('ESTIMATED TOTAL', money(o.total) + (o.needsQuote ? ' + commercial quote' : '') + ' per visit'));
  lines.push('', '--- Notes ---', d.get('notes') || '-');
  lines.push('', 'Estimate only. Final price confirmed before cleaning.');
  return lines.join('\n');
}

function validate() {
  const missing = ['name', 'phone', 'address', 'city'].filter((id) => !$(id).value.trim());
  form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
  missing.forEach((id) => $(id).classList.add('invalid'));
  const err = $('form-error');
  if (missing.length) {
    err.textContent = 'Please fill in your name, phone, address and city.';
    err.hidden = false;
    $(missing[0]).focus();
    return false;
  }
  err.hidden = true;
  return true;
}

form.addEventListener('input', render);
form.addEventListener('change', render);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validate()) return;
  const o = getOrder();
  const body = buildEmail(o);
  const subject = 'New Cleaning Order - ' + o.data.get('name') + ' (' + o.data.get('city') + ')';
  window.location.href = 'mailto:' + EMAIL +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);

  // Offer a copy option in case no email app is set up (e.g. Gmail in browser only).
  $('fallback').hidden = false;
  $('copy-btn').onclick = () => {
    const done = () => { $('copy-btn').textContent = 'Copied!'; };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(body).then(done, () => window.prompt('Copy your order:', body));
    } else {
      window.prompt('Copy your order:', body);
    }
  };
});

// Don't allow picking a date in the past.
$('date').min = new Date().toLocaleDateString('en-CA');

render();
