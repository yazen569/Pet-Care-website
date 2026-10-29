// Booking (book.html) and review (reviews.html) forms. They talk to server.py,
// which saves entries to data/appointments.txt and data/reviews.txt.

const SERVER_HINT = 'Could not reach the site server. Start it with "python3 server.py" and open http://localhost:8000.';

async function api(url, data) {
  let response, body;
  try {
    response = await fetch(url, data && {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    body = await response.json();
  } catch (error) {
    throw new Error(SERVER_HINT);
  }
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}

// Checkbox groups that share a name (with values) become arrays; single checkboxes become true/false.
function formToObject(form) {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  form.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    data[box.name] = box.hasAttribute('value') ? formData.getAll(box.name) : box.checked;
  });
  return data;
}

function formatPrice(price, fromPrice) {
  if (price === 0 && !fromPrice) return 'Free';
  return `${fromPrice ? 'from ' : ''}$${price}`;
}

function todayISO() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function setStatus(element, message, isError) {
  element.textContent = message;
  element.classList.toggle('error', Boolean(isError));
}

/* ---------- Booking (book.html) ---------- */

function initBooking(bookingForm) {
  const bookingStatus = document.getElementById('booking-status');
  const confirmation = document.getElementById('booking-confirmation');
  const dateInput = bookingForm.elements.date;
  const picker = document.getElementById('service-picker');
  const groups = [...picker.querySelectorAll('.service-group')];
  const serviceBoxes = [...picker.querySelectorAll('input[name="services"]')];
  const selectionTotal = document.getElementById('selection-total');

  dateInput.min = todayISO();

  function checkedServices() {
    return serviceBoxes.filter((box) => box.checked);
  }

  function updateTotal() {
    const chosen = checkedServices();
    if (!chosen.length) {
      selectionTotal.textContent = 'No services selected yet';
      return;
    }
    const total = chosen.reduce((sum, box) => sum + Number(box.dataset.price), 0);
    const fromPrice = chosen.some((box) => box.hasAttribute('data-from'));
    const count = `${chosen.length} service${chosen.length === 1 ? '' : 's'} selected`;
    selectionTotal.textContent = `${count}. Estimated total: ${formatPrice(total, fromPrice)}`;
  }

  serviceBoxes.forEach((box) => box.addEventListener('change', updateTotal));

  dateInput.addEventListener('change', () => {
    const isSunday = dateInput.value && new Date(`${dateInput.value}T00:00`).getDay() === 0;
    setStatus(bookingStatus, isSunday ? "We're closed on Sundays. Please pick another day." : '', isSunday);
  });

  // Links from other pages can pre-fill the form:
  //   ?group=Dog+grooming highlights that group (services page)
  //   ?services=...&services=... ticks those services (AI assistant)
  const params = new URLSearchParams(window.location.search);
  groups.filter((group) => group.dataset.group && group.dataset.group === params.get('group'))
    .forEach((group) => group.classList.add('highlight'));
  const wanted = params.getAll('services');
  serviceBoxes.forEach((box) => { if (wanted.includes(box.value)) box.checked = true; });
  updateTotal();

  function showConfirmation(booking) {
    const count = booking.services.length;
    document.getElementById('booking-summary').textContent =
      `${booking.pet_name} is booked on ${formatDate(booking.date)} for ${count} service${count === 1 ? '' : 's'}:`;
    const tbody = document.querySelector('#booking-items tbody');
    tbody.replaceChildren();
    booking.services.forEach((item) => {
      const row = tbody.insertRow();
      row.insertCell().textContent = item.name;
      const price = row.insertCell();
      price.className = 'amount';
      price.textContent = formatPrice(item.price, item.from_price);
    });
    document.getElementById('booking-total').textContent = booking.total;
    document.getElementById('booking-reference').textContent = booking.reference;
  }

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!checkedServices().length) {
      setStatus(bookingStatus, 'Please choose at least one service.', true);
      picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const button = bookingForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus(bookingStatus, 'Booking...');
    try {
      showConfirmation(await api('/api/appointments', formToObject(bookingForm)));
      bookingForm.hidden = true;
      confirmation.hidden = false;
      setStatus(bookingStatus, '');
    } catch (error) {
      setStatus(bookingStatus, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById('book-another').addEventListener('click', () => {
    bookingForm.reset();
    groups.forEach((group) => group.classList.remove('highlight'));
    updateTotal();
    confirmation.hidden = true;
    bookingForm.hidden = false;
  });
}

/* ---------- Reviews (reviews.html) ---------- */

function initReviews(reviewForm) {
  const reviewStatus = document.getElementById('review-status');
  const reviewList = document.getElementById('review-list');
  const reviewThanks = document.getElementById('review-thanks');

  function renderReview(review) {
    const card = document.createElement('article');
    card.className = 'review';

    const rating = document.createElement('p');
    rating.className = 'review-rating';
    rating.textContent = `Rating: ${review.rating}/5`;

    const text = document.createElement('p');
    text.textContent = review.review;

    const author = document.createElement('p');
    author.className = 'review-author';
    author.textContent = review.pet_name ? `${review.name}, with ${review.pet_name}` : review.name;

    card.append(rating, text, author);
    return card;
  }

  async function loadReviews() {
    try {
      const { reviews } = await api('/api/reviews');
      reviewList.replaceChildren(...reviews.map(renderReview));
      if (!reviews.length) {
        reviewList.innerHTML = '<p class="muted">No reviews yet. Be the first to share your experience.</p>';
      }
    } catch (error) {
      reviewList.replaceChildren();
    }
  }

  document.getElementById('write-review').addEventListener('click', () => {
    reviewForm.hidden = !reviewForm.hidden;
    setStatus(reviewStatus, '');
    reviewThanks.textContent = '';
    if (!reviewForm.hidden) reviewForm.elements.name.focus();
  });

  reviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = reviewForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus(reviewStatus, 'Submitting...');
    try {
      await api('/api/reviews', formToObject(reviewForm));
      reviewForm.reset();
      reviewForm.hidden = true;
      setStatus(reviewStatus, '');
      reviewThanks.textContent = 'Thanks for your review!';
      await loadReviews();
    } catch (error) {
      setStatus(reviewStatus, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  loadReviews();
}

const bookingFormElement = document.getElementById('booking-form');
if (bookingFormElement) initBooking(bookingFormElement);
const reviewFormElement = document.getElementById('review-form');
if (reviewFormElement) initReviews(reviewFormElement);
