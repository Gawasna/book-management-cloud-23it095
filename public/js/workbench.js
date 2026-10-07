/**
 * Workbench Client Controller
 * Manages F-Pattern UI interactions, dynamic form state, split book code logic, dirty checking, and live validations.
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('bookForm');
  if (!form) return;

  const requiredPrefix = form.dataset.requiredPrefix || '095';
  const vatRate = Number(form.dataset.vatRate) || 9;

  // Form input references
  const inputId = document.getElementById('bookId');
  const inputCodePrefix = document.getElementById('bookCodePrefix');
  const inputCodeSuffix = document.getElementById('bookCodeSuffix');
  const inputCode = document.getElementById('bookCode');
  const inputTitle = document.getElementById('title');
  const inputAuthor = document.getElementById('author');
  const inputPrice = document.getElementById('originalPrice');

  // Form panel action elements
  const formPanelTitle = document.getElementById('formPanelTitle');
  const formPanelTag = document.getElementById('formPanelTag');
  const actionAdd = document.getElementById('actionAdd');
  const actionEdit = document.getElementById('actionEdit');
  const btnUpdate = document.getElementById('btnUpdate');
  const btnDeleteTrigger = document.getElementById('btnDeleteTrigger');
  const btnCancel = document.getElementById('btnCancel');
  const deleteConfirmBadge = document.getElementById('deleteConfirmBadge');
  const btnCancelDelete = document.getElementById('btnCancelDelete');

  // Hint elements
  const hintCode = document.getElementById('hintCode');
  const hintPrice = document.getElementById('hintPrice');

  // Workbench layout references
  const workbenchAside = document.getElementById('workbenchAside');
  const booksTableBody = document.getElementById('booksTableBody');

  // Internal state
  let selectedRow = null;
  let originalSnapshot = null;

  // 1. Format dates in table cells
  document.querySelectorAll('.cell-date').forEach(el => {
    const text = el.textContent.trim();
    if (text.includes('GMT') || text.includes('Giờ Đông Dương')) {
      const d = new Date(text);
      if (!isNaN(d.getTime())) {
        const pad = n => String(n).padStart(2, '0');
        el.textContent = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
  });

  // 2. Tự động ghép nối tiền tố và hậu tố với dấu gạch ngang (-)
  function updateCompositeBookCode() {
    const p = (inputCodePrefix ? inputCodePrefix.value.trim() : '');
    const s = (inputCodeSuffix ? inputCodeSuffix.value.trim().replace(/^-+/, '') : '');

    if (p && s) {
      const fullCode = `${p}-${s}`;
      inputCode.value = fullCode;
      if (p === requiredPrefix) {
        hintCode.innerHTML = `Mã đầy đủ: <strong>${fullCode}</strong> (hợp lệ)`;
        hintCode.className = 'field-hint hint-valid';
      } else {
        hintCode.innerHTML = `Mã đầy đủ: <strong>${fullCode}</strong> (Cảnh báo: Tiền tố khác ${requiredPrefix})`;
        hintCode.className = 'field-hint hint-warning';
      }
    } else if (p) {
      inputCode.value = `${p}-`;
      hintCode.innerHTML = `Mã đầy đủ: <strong>${p}-...</strong> (vui lòng nhập mã hậu tố)`;
      hintCode.className = p === requiredPrefix ? 'field-hint' : 'field-hint hint-warning';
    } else {
      inputCode.value = '';
      hintCode.innerHTML = `Tiền tố bắt buộc: <strong>${requiredPrefix}</strong>`;
      hintCode.className = 'field-hint';
    }
  }

  // 3. Non-blocking Live Validation & Input Events
  if (inputCodePrefix) {
    inputCodePrefix.addEventListener('input', () => {
      updateCompositeBookCode();
      checkDirtyState();
    });
  }

  if (inputCodeSuffix) {
    inputCodeSuffix.addEventListener('input', () => {
      updateCompositeBookCode();
      checkDirtyState();
    });
  }

  // Luôn đảm bảo input ẩn bookCode có giá trị đầy đủ trước khi submit
  form.addEventListener('submit', () => {
    const p = (inputCodePrefix ? inputCodePrefix.value.trim() : '');
    const s = (inputCodeSuffix ? inputCodeSuffix.value.trim().replace(/^-+/, '') : '');
    if (p && s) {
      inputCode.value = `${p}-${s}`;
    }
  });

  inputPrice.addEventListener('input', () => {
    const val = Number(inputPrice.value);
    if (!isNaN(val) && val > 0) {
      const estFinal = Math.round(val * (1 + vatRate / 100));
      hintPrice.innerHTML = `+${vatRate}% VAT -> Dự kiến sau thuế: <strong>${new Intl.NumberFormat('vi-VN').format(estFinal)} đ</strong>`;
      hintPrice.className = 'field-hint hint-valid';
    } else {
      hintPrice.innerHTML = `+${vatRate}% VAT`;
      hintPrice.className = 'field-hint';
    }
    checkDirtyState();
  });

  inputTitle.addEventListener('input', checkDirtyState);
  inputAuthor.addEventListener('input', checkDirtyState);

  // 4. Dirty state checker: Disable delete button if fields are modified
  function checkDirtyState() {
    if (!selectedRow || !originalSnapshot) return;

    const currentPrefix = inputCodePrefix ? inputCodePrefix.value.trim() : '';
    const currentSuffix = inputCodeSuffix ? inputCodeSuffix.value.trim() : '';

    const isDirty =
      currentPrefix !== originalSnapshot.prefix ||
      currentSuffix !== originalSnapshot.suffix ||
      inputTitle.value.trim() !== originalSnapshot.title ||
      inputAuthor.value.trim() !== originalSnapshot.author ||
      inputPrice.value.trim() !== originalSnapshot.price;

    if (isDirty) {
      btnDeleteTrigger.disabled = true;
      btnDeleteTrigger.classList.add('btn-disabled');
      btnDeleteTrigger.title = 'Đang có chỉnh sửa chưa lưu: Nút xóa bị vô hiệu hóa';
      if (deleteConfirmBadge) deleteConfirmBadge.style.display = 'none';
    } else {
      btnDeleteTrigger.disabled = false;
      btnDeleteTrigger.classList.remove('btn-disabled');
      btnDeleteTrigger.removeAttribute('title');
    }
  }

  // 5. Select item row in book table
  document.querySelectorAll('.selectable-row').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();

      // Clear previous selection highlight
      if (selectedRow) selectedRow.classList.remove('row-selected');

      selectedRow = row;
      selectedRow.classList.add('row-selected');

      // Populate left form with selected row attributes
      const id = row.getAttribute('data-id');
      const code = row.getAttribute('data-code') || '';
      const title = row.getAttribute('data-title') || '';
      const author = row.getAttribute('data-author') || '';
      const price = row.getAttribute('data-price') || '';

      // Tách mã sách thành 2 phần: Tiền tố và Hậu tố
      let prefix = requiredPrefix;
      let suffix = '';
      if (code.includes('-')) {
        const idx = code.indexOf('-');
        prefix = code.slice(0, idx);
        suffix = code.slice(idx + 1);
      } else if (code.startsWith(requiredPrefix)) {
        prefix = requiredPrefix;
        suffix = code.slice(requiredPrefix.length);
      } else {
        prefix = code;
        suffix = '';
      }

      inputId.value = id || '';
      if (inputCodePrefix) inputCodePrefix.value = prefix;
      if (inputCodeSuffix) inputCodeSuffix.value = suffix;
      inputCode.value = code;
      inputTitle.value = title;
      inputAuthor.value = author;
      inputPrice.value = price;

      originalSnapshot = { prefix, suffix, title, author, price };

      // Switch form state to Update / Delete
      form.action = '/books/update';
      formPanelTitle.textContent = 'Chi Tiết / Sửa Sách';
      formPanelTag.textContent = 'Edit';
      actionAdd.style.display = 'none';
      actionEdit.style.display = 'block';
      if (deleteConfirmBadge) deleteConfirmBadge.style.display = 'none';

      btnDeleteTrigger.disabled = false;
      btnDeleteTrigger.classList.remove('btn-disabled');
      btnDeleteTrigger.removeAttribute('title');

      // Refresh hints
      updateCompositeBookCode();
      inputPrice.dispatchEvent(new Event('input'));
    });
  });

  // 6. Deselect & Reset Form to Create mode
  function clearSelection() {
    if (selectedRow) {
      selectedRow.classList.remove('row-selected');
      selectedRow = null;
    }
    originalSnapshot = null;

    form.reset();
    inputId.value = '';
    if (inputCodePrefix) inputCodePrefix.value = requiredPrefix;
    if (inputCodeSuffix) inputCodeSuffix.value = '';
    inputCode.value = '';

    form.action = '/books';
    formPanelTitle.textContent = 'Thêm Sách';
    formPanelTag.textContent = 'Write';

    actionAdd.style.display = 'block';
    actionEdit.style.display = 'none';
    if (deleteConfirmBadge) deleteConfirmBadge.style.display = 'none';

    updateCompositeBookCode();
    hintPrice.innerHTML = `+${vatRate}% VAT`;
    hintPrice.className = 'field-hint';
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSelection();
    });
  }

  // Click outside workbench aside and table body to deselect
  document.addEventListener('click', (e) => {
    if (
      selectedRow &&
      workbenchAside && !workbenchAside.contains(e.target) &&
      (!booksTableBody || !booksTableBody.contains(e.target))
    ) {
      clearSelection();
    }
  });

  // 7. Delete confirmation badge toggling
  if (btnDeleteTrigger) {
    btnDeleteTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btnDeleteTrigger.disabled) return;
      if (deleteConfirmBadge) deleteConfirmBadge.style.display = 'block';
    });
  }

  if (btnCancelDelete) {
    btnCancelDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deleteConfirmBadge) deleteConfirmBadge.style.display = 'none';
    });
  }

  // Khởi tạo trạng thái ban đầu cho hint mã sách
  updateCompositeBookCode();
});
