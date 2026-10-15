// MVP: links are placeholders and intentionally do nothing.
document.addEventListener('click', function (event) {
  if (event.target.closest('a[data-mvp]')) event.preventDefault();
});
