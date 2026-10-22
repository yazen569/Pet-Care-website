# Pawsitive Care: MVP Website

MVP website for **Pawsitive Care**, a welcoming grooming and vaccination business for dogs and cats, with a focus on new pet owners.

## Run it locally

You need Python 3 (nothing else to install). From this folder:

```bash
python3 server.py
```

Then open http://localhost:8000. Press `Ctrl+C` to stop. To use another port: `python3 server.py 9000`.

You can still open `index.html` directly in a browser to look at the page, but booking and reviews only work when the server is running.

## Features

- **Booking:** "Book an appointment" and the "Book ..." buttons on each service card take you to the booking form (the card buttons pre-select the matching service). Taken time slots show as "(booked)", Sundays are closed, and each booking gets a reference number like `PC-1A2B3C`.
- **Reviews:** "Write a review" opens a form. Submitted reviews show on the page, newest first.
- **Contact us** section at the bottom (placeholder address, phone and email).
- **Logo:** `images/logo.svg`, also used as the browser tab icon.

## Where the data is saved

| File | What's in it |
|---|---|
| `data/appointments.txt` | One booking per line |
| `data/reviews.txt` | One review per line |

Fields are separated by ` | ` and the first line of each file lists the field names. The server never sends these files to the browser, so visitors can't read other people's bookings.

## Structure

```
index.html            The page (text, prices, forms)
css/styles.css        Styles
js/main.js            Booking and review form logic
images/logo.svg       Logo
server.py             Local server; saves bookings and reviews
data/                 appointments.txt and reviews.txt
tests/test_server.py  Tests: python3 -m unittest discover -s tests
```
