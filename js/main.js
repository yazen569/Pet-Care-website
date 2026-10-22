// Booking and review forms. They talk to server.py, which saves entries to
// data/appointments.txt and data/reviews.txt.

const SERVER_HINT = 'Could not reach the site server. Start it with "python3 server.py" and open http://localhost:8000.';
const TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

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

function formToObject(form) {
  const data = Object.fromEntries(new FormData(form));
  form.querySelectorAll('input[type="checkbox"]').forEach((box) => { data[box.name] = box.checked; });
  return data;
}

function todayISO() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatTime(time) {
  const hour = Number(time.slice(0, 2));
  return `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
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

/* ---------- Booking ---------- */

const bookingForm = document.getElementById('booking-form');
const bookingStatus = document.getElementById('booking-status');
const confirmation = document.getElementById('booking-confirmation');
const dateInput = bookingForm.elements.date;
const timeSelect = bookingForm.elements.time;
const serviceSelect = bookingForm.elements.service;
const petTypeSelect = bookingForm.elements.pet_type;

dateInput.min = todayISO();

// "Book dog grooming" etc. pre-select the first service in that group.
document.querySelectorAll('[data-book]').forEach((button) => {
  button.addEventListener('click', () => {
    const group = serviceSelect.querySelector(`optgroup[label="${button.dataset.book}"]`);
    if (group) serviceSelect.value = group.querySelector('option').value;
    serviceSelect.dispatchEvent(new Event('change'));
  });
});

// Services that start with "Dog:" or "Cat:" set the pet type to match.
serviceSelect.addEventListener('change', () => {
  const species = serviceSelect.value.split(':')[0];
  if (species === 'Dog' || species === 'Cat') petTypeSelect.value = species;
});

async function loadTimes() {
  const day = dateInput.value;
  timeSelect.innerHTML = '';
  timeSelect.disabled = true;

  const placeholder = new Option(day ? 'Loading times...' : 'Pick a date first', '');
  timeSelect.add(placeholder);
  if (!day) return;

  if (new Date(`${day}T00:00`).getDay() === 0) {
    placeholder.text = 'Closed on Sundays';
    return;
  }

  let booked = [];
  try {
    booked = (await api(`/api/appointments?date=${encodeURIComponent(day)}`)).booked;
  } catch (error) {
    placeholder.text = 'Times unavailable';
    setStatus(bookingStatus, error.message, true);
    return;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let openSlots = 0;
  placeholder.text = 'Choose a time';
  TIMES.forEach((time) => {
    const isBooked = booked.includes(time);
    const isPast = day === todayISO() && time <= currentTime;
    const option = new Option(formatTime(time) + (isBooked ? ' (booked)' : ''), time);
    option.disabled = isBooked || isPast;
    if (!option.disabled) openSlots += 1;
    timeSelect.add(option);
  });
  if (openSlots === 0) placeholder.text = 'Fully booked, please try another day';
  timeSelect.disabled = false;
}

dateInput.addEventListener('change', () => {
  setStatus(bookingStatus, '');
  loadTimes();
});

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = bookingForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus(bookingStatus, 'Booking...');
  try {
    const booking = await api('/api/appointments', formToObject(bookingForm));
    document.getElementById('booking-summary').textContent =
      `${booking.pet_name} is booked for ${booking.service} on ${formatDate(booking.date)} at ${formatTime(booking.time)}.`;
    document.getElementById('booking-reference').textContent = booking.reference;
    bookingForm.hidden = true;
    confirmation.hidden = false;
    setStatus(bookingStatus, '');
  } catch (error) {
    setStatus(bookingStatus, error.message, true);
    loadTimes();
  } finally {
    button.disabled = false;
  }
});

document.getElementById('book-another').addEventListener('click', () => {
  bookingForm.reset();
  loadTimes();
  confirmation.hidden = true;
  bookingForm.hidden = false;
});

/* ---------- Reviews ---------- */

const reviewForm = document.getElementById('review-form');
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
