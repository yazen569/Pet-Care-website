// MVP: links marked with data-mvp are placeholders. Show a "coming soon"
// message instead of jumping to the top of the page.
(function () {
  var toast = document.getElementById('toast');
  var timer;

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-mvp]');
    if (!link) return;
    event.preventDefault();

    toast.textContent = '"' + link.textContent.trim() + '" is coming soon!';
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2200);
  });
})();
