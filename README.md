# Pawsitive Care: MVP Website

MVP website for **Pawsitive Care**, a welcoming grooming and vaccination business for dogs and cats, with a focus on new pet owners.

## Run it locally

You need Python 3 (nothing else to install). From this folder:

```bash
python3 server.py
```

Then open http://localhost:8000. Press `Ctrl+C` to stop. To use another port: `python3 server.py 9000`.

You can also open the `.html` files directly in a browser to look around (the AI assistant works this way too), but booking and reviews only work when the server is running.

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Home: headline, mission statement (welcoming new pet owners) and a link to the AI assistant |
| `services.html` | Services and prices, with what is and isn't included |
| `assistant.html` | AI care assistant |
| `book.html` | Booking form |
| `reviews.html` | Reviews and "Write a review" form |
| `contact.html` | Address, phone, email and hours |

## Features

- **AI care assistant (demo):** visitors describe their pet in their own words and get recommended services with an estimated total, then "Book these services" opens the booking form pre-filled. If the description doesn't say dog or cat, it asks. **This is not a real AI model.** `js/assistant.js` matches keywords against the price list and animates the reply (typing indicator, word-by-word text) so it looks live in a demo. Prices live in `SERVICES` in `server.py`; the booking checklist and `js/assistant.js` must match it (tests check both), and `services.html` should be updated by hand.
- **Booking:** pick one or more services from a checklist that shows each price and a running total. Choosing dog or cat hides the other pet's services. The "Book ..." buttons on the services page open the form with that group highlighted, and the AI assistant's "Book these services" ticks everything it recommended. Taken time slots show as "(booked)", Sundays are closed, and the confirmation lists each service with its price, the total and a reference number like `PC-1A2B3C`. The total is worked out by the server from its own price list.
- **Reviews:** "Write a review" opens a form. Submitted reviews show on the page, newest first.
- **Logo:** `images/logo.svg`, also used as the browser tab icon.

## Where the data is saved

| File | What's in it |
|---|---|
| `data/appointments.txt` | One booking per line, with its services (separated by `; `) and total |
| `data/reviews.txt` | One review per line |

Fields are separated by ` | ` and the first line of each file lists the field names. The server never sends these files to the browser, so visitors can't read other people's bookings.

## Structure

```
*.html                The six pages (each has the same header, menu and contact footer)
css/styles.css        Styles
js/main.js            Booking and review form logic
js/assistant.js       AI assistant demo (keyword rules + chat animation)
images/logo.svg       Logo
server.py             Local server; saves bookings and reviews
data/                 appointments.txt and reviews.txt
tests/test_server.py  Tests: python3 -m unittest discover -s tests
```

When adding a new page, also add it to `PUBLIC_FILES` in `server.py` (a test checks this).
