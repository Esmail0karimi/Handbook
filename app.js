(() => {
  const $ = id => document.getElementById(id);
  const input = $('pdfInput'), welcome = $('welcome'), reader = $('reader');
  let pdf = null, current = 1, pageTexts = [], fileKey = '', speechUtterance = null;
  const translations = {};
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function storageKey(page) { return 'handbook-translation:' + fileKey + ':' + page; }
  function loadTranslation(page) {
    try { return localStorage.getItem(storageKey(page)) || ''; } catch { return ''; }
  }
  function saveTranslation() {
    if (!pdf) return;
    const value = $('persianText').value;
    try {
      localStorage.setItem(storageKey(current), value);
      $('saveState').textContent = 'ذخیره شد';
    } catch { $('saveState').textContent = 'فضای ذخیره‌سازی مرورگر کافی نیست'; }
    $('charCount').textContent = value.length.toLocaleString('fa-IR') + ' نویسه';
  }
  async function extractPage(n) {
    if (pageTexts[n - 1] !== undefined) return pageTexts[n - 1];
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ').replace(/[ \t]+/g, ' ').replace(/\s+\n/g, '\n').trim();
    pageTexts[n - 1] = text || '[No selectable text found on this page. It may be a scanned image.]';
    return pageTexts[n - 1];
  }
  async function showPage(n) {
    if (!pdf || n < 1 || n > pdf.numPages) return;
    current = n;
    $('englishText').textContent = 'Loading page…';
    $('pageNumber').textContent = n + ' / ' + pdf.numPages;
    $('currentPageLabel').textContent = 'صفحه ' + n.toLocaleString('fa-IR');
    $('prevPage').disabled = n === 1; $('nextPage').disabled = n === pdf.numPages;
    $('persianText').value = loadTranslation(n);
    $('charCount').textContent = $('persianText').value.length.toLocaleString('fa-IR') + ' نویسه';
    $('saveState').textContent = 'ذخیره خودکار در همین مرورگر';
    try { $('englishText').textContent = await extractPage(n); }
    catch (e) { $('englishText').textContent = 'Could not extract this page: ' + e.message; }
    document.querySelectorAll('.page-item').forEach(el => el.classList.toggle('active', Number(el.dataset.page) === n));
    const pct = Math.round(n / pdf.numPages * 100);
    $('progressFill').style.width = pct + '%'; $('progressText').textContent = pct.toLocaleString('fa-IR') + '٪';
    const active = document.querySelector('.page-item.active');
    if (active) active.scrollIntoView({block:'nearest'});
  }
  function buildPageList() {
    const list = $('pageList'); list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let n = 1; n <= pdf.numPages; n++) {
      const button = document.createElement('button');
      button.className = 'page-item'; button.dataset.page = n;
      button.textContent = 'صفحه ' + n.toLocaleString('fa-IR');
      button.addEventListener('click', () => showPage(n));
      fragment.appendChild(button);
    }
    list.appendChild(fragment);
  }
  input.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { toast('لطفاً یک فایل PDF انتخاب کن.'); return; }
    $('fileStatus').textContent = 'در حال خواندن PDF…';
    try {
      const bytes = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({data: bytes}).promise;
      fileKey = file.name + ':' + file.size;
      pageTexts = new Array(pdf.numPages);
      $('bookName').textContent = file.name;
      $('pageCount').textContent = pdf.numPages.toLocaleString() + ' pages';
      $('fileStatus').textContent = file.name;
      welcome.classList.add('hidden'); reader.classList.remove('hidden');
      buildPageList(); await showPage(1);
      toast('کتاب آماده مطالعه است.');
    } catch (err) {
      $('fileStatus').textContent = 'خطا در بارگذاری';
      toast('PDF باز نشد: ' + err.message);
    }
  });
  $('prevPage').addEventListener('click', () => showPage(current - 1));
  $('nextPage').addEventListener('click', () => showPage(current + 1));
  $('persianText').addEventListener('input', () => {
    $('saveState').textContent = 'در حال ذخیره…';
    clearTimeout(saveTranslation.timer); saveTranslation.timer = setTimeout(saveTranslation, 450);
    $('charCount').textContent = $('persianText').value.length.toLocaleString('fa-IR') + ' نویسه';
  });
  $('pageSearch').addEventListener('input', async e => {
    const q = e.target.value.trim().toLowerCase();
    const list = $('pageList');
    for (const button of list.children) {
      const n = Number(button.dataset.page);
      if (!q) { button.hidden = false; continue; }
      const text = await extractPage(n);
      button.hidden = !text.toLowerCase().includes(q);
    }
  });
  function speak(text, lang) {
    if (!('speechSynthesis' in window)) { toast('مرورگر شما از پخش متن پشتیبانی نمی‌کند.'); return; }
    speechSynthesis.cancel();
    if (!text.trim()) { toast('متنی برای خواندن وجود ندارد.'); return; }
    speechUtterance = new SpeechSynthesisUtterance(text);
    speechUtterance.lang = lang; speechUtterance.rate = 0.92;
    const voices = speechSynthesis.getVoices();
    const match = voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (match) speechUtterance.voice = match;
    speechSynthesis.speak(speechUtterance);
  }
  $('speakEnglish').addEventListener('click', () => speak($('englishText').textContent, 'en-US'));
  $('speakPersian').addEventListener('click', () => speak($('persianText').value, 'fa-IR'));
  $('stopSpeech').addEventListener('click', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); });
  document.addEventListener('keydown', e => {
    if (!pdf || ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') showPage(current + 1);
    if (e.key === 'ArrowRight') showPage(current - 1);
  });
})();