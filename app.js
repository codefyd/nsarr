(function () {
  const API_URL = window.APP_CONFIG && window.APP_CONFIG.API_URL;
  const state = {
    token: localStorage.getItem('quran_center_token') || '',
    userName: localStorage.getItem('quran_center_name') || '',
    userRole: localStorage.getItem('quran_center_role') || ''
  };

  const loginModal = new bootstrap.Modal(document.getElementById('staffLoginModal'));

  function ensureConfig() {
    if (!API_URL || API_URL.includes('ضع-هنا')) {
      Swal.fire({
        icon: 'warning',
        title: 'أكمل الإعداد أولاً',
        text: 'انسخ config.example.js إلى config.js وضع رابط Google Apps Script المنشور.'
      });
      return false;
    }
    return true;
  }

  async function api(action, data = {}, withToken = false) {
    if (!ensureConfig()) throw new Error('Missing config');
    const body = new URLSearchParams();
    body.append('action', action);
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) body.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
    });
    if (withToken && state.token) body.append('token', state.token);

    const res = await fetch(API_URL, {
      method: 'POST',
      body
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'حدث خطأ');
    return json;
  }

  function showView(name) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('d-none'));
    const map = {
      home: 'homeView',
      register: 'registerView',
      'student-data': 'studentDataView',
      staff: 'staffView'
    };
    document.getElementById(map[name] || 'homeView').classList.remove('d-none');
    if (name === 'staff') loadStaffDashboard();
  }

  function route() {
    const hash = (location.hash || '#/home').replace('#/', '');
    if (hash === 'staff' && !state.token) {
      loginModal.show();
      location.hash = '#/home';
      return;
    }
    showView(hash);
  }

  function setSession(data) {
    state.token = data.token;
    state.userName = data.name;
    state.userRole = data.role;
    localStorage.setItem('quran_center_token', data.token);
    localStorage.setItem('quran_center_name', data.name);
    localStorage.setItem('quran_center_role', data.role);
    updateAuthUI();
  }

  function clearSession() {
    state.token = '';
    state.userName = '';
    state.userRole = '';
    localStorage.removeItem('quran_center_token');
    localStorage.removeItem('quran_center_name');
    localStorage.removeItem('quran_center_role');
    updateAuthUI();
  }

  function updateAuthUI() {
    document.getElementById('logoutBtn').classList.toggle('d-none', !state.token);
  }

  document.getElementById('openStaffLoginBtn').addEventListener('click', () => loginModal.show());
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      if (state.token) await api('logout', {}, true);
    } catch (e) {}
    clearSession();
    location.hash = '#/home';
  });

  document.getElementById('staffLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await api('login', { code: document.getElementById('staffCode').value });
      setSession(res.data);
      loginModal.hide();
      await Swal.fire({ icon: 'success', title: 'تم تسجيل الدخول', timer: 1200, showConfirmButton: false });
      location.hash = '#/staff';
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'تعذر الدخول', text: err.message });
    }
  });

  document.getElementById('registrationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await api('registerStudent', data);
      e.target.reset();
      Swal.fire({ icon: 'success', title: 'تم إرسال الطلب', html: `رقم الطلب: <strong>${res.data.requestId}</strong>` });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'تعذر الإرسال', text: err.message });
    }
  });

  document.getElementById('studentLookupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await api('getStudentData', data);
      renderStudentResult(res.data);
    } catch (err) {
      document.getElementById('studentResult').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  });

  function renderStudentResult(student) {
    document.getElementById('studentResult').innerHTML = `
      <div class="panel-card">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h5 class="mb-1 fw-bold">${student.studentName}</h5>
            <div class="small-muted">الحلقة: ${student.circle || 'غير محددة'} — الحالة: ${student.status || '-'}</div>
          </div>
          <button class="btn btn-outline-primary btn-sm" id="requestStudentEditBtn">طلب تعديل بيانات</button>
        </div>
        <div class="data-grid">
          ${dataItem('هوية الطالب', student.studentId)}
          ${dataItem('جوال الطالب', student.studentPhone || '-')}
          ${dataItem('جوال ولي الأمر', student.guardianPhone || '-')}
          ${dataItem('تاريخ الميلاد', student.studentBirthDate || '-')}
          ${dataItem('المرحلة', student.studentLevel || '-')}
          ${dataItem('الصف', student.studentGrade || '-')}
          ${dataItem('العنوان', student.studentAddress || '-')}
          ${dataItem('مجموع الحفظ', student.memorized || '0')}
        </div>
      </div>`;

    document.getElementById('requestStudentEditBtn').addEventListener('click', async () => {
      const { value: formValues } = await Swal.fire({
        title: 'طلب تعديل بيانات',
        html: `
          <select id="swal-field" class="swal2-input">
            <option value="studentPhone">رقم جوال الطالب</option>
            <option value="studentAddress">العنوان / الحي</option>
            <option value="guardianPhone">رقم جوال ولي الأمر</option>
          </select>
          <input id="swal-value" class="swal2-input" placeholder="القيمة الجديدة">
          <input id="swal-notes" class="swal2-input" placeholder="ملاحظات">
        `,
        focusConfirm: false,
        preConfirm: () => ({
          fieldName: document.getElementById('swal-field').value,
          newValue: document.getElementById('swal-value').value,
          notes: document.getElementById('swal-notes').value
        })
      });
      if (!formValues) return;
      try {
        await api('requestStudentUpdate', { studentId: student.studentId, ...formValues });
        Swal.fire({ icon: 'success', title: 'تم إرسال طلب التعديل' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'تعذر إرسال الطلب', text: err.message });
      }
    });
  }

  function dataItem(label, value) {
    return `<div class="data-item"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  }

  async function loadStaffDashboard() {
    try {
      const statsRes = await api('getDashboardStats', {}, true);
      renderStats(statsRes.data);
      document.getElementById('staffWelcome').textContent = `مرحبًا ${state.userName} — ${state.userRole}`;
      await Promise.all([loadRequests(), loadStudents(), loadWarnings(), loadSettings()]);
      applyRoleVisibility();
    } catch (err) {
      clearSession();
      Swal.fire({ icon: 'error', title: 'انتهت الجلسة أو لا توجد صلاحية', text: err.message });
      location.hash = '#/home';
    }
  }

  function renderStats(data) {
    document.getElementById('dashboardStats').innerHTML = `
      ${statCard('إجمالي الطلاب', data.studentsCount, 'fa-users')}
      ${statCard('الطلبات الجديدة', data.newRequestsCount, 'fa-inbox')}
      ${statCard('إجمالي الإنذارات', data.warningsCount, 'fa-triangle-exclamation')}
      ${statCard('الحلق', data.circlesCount, 'fa-layer-group')}`;
  }

  function statCard(label, value, icon) {
    return `<div class="col-md-3 col-sm-6"><div class="kpi-card"><div class="bg-icon-float"><i class="fa-solid ${icon}"></i></div><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div></div>`;
  }

  async function loadRequests() {
    const wrap = document.getElementById('requestsTab');
    try {
      const res = await api('getIncomingRequests', { type: 'all' }, true);
      wrap.innerHTML = `
        <div class="table-card">
          <div class="d-flex justify-content-between align-items-center mb-3"><h5 class="mb-0">الطلبات الواردة</h5></div>
          ${renderRequestsTable(res.data)}
        </div>`;
      bindRequestActions();
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-warning">${err.message}</div>`;
    }
  }

  function renderRequestsTable(items) {
    if (!items.length) return '<div class="text-muted">لا توجد طلبات حالياً</div>';
    return `<div class="table-responsive"><table class="table align-middle">
      <thead><tr><th>رقم الطلب</th><th>النوع</th><th>الاسم</th><th>الهوية</th><th>الحالة</th><th>التاريخ</th><th>إجراء</th></tr></thead>
      <tbody>${items.map(item => `
        <tr>
          <td>${item['id']}</td>
          <td>${item['نوع الطلب']}</td>
          <td>${item['اسم الطالب ثلاثي']}</td>
          <td>${item['هوية الطالب']}</td>
          <td>${item['حالة الطلب']}</td>
          <td>${formatDate(item['تاريخ الطلب'])}</td>
          <td>
            ${canManageRequests() && (item['حالة الطلب'] === 'جديد' || item['حالة الطلب'] === 'قيد المراجعة') ? `
              <button class="btn btn-sm btn-success req-approve" data-id="${item['id']}">اعتماد</button>
              <button class="btn btn-sm btn-outline-danger req-reject" data-id="${item['id']}">رفض</button>
            ` : '<span class="small-muted">—</span>'}
          </td>
        </tr>`).join('')}</tbody></table></div>`;
  }

  function bindRequestActions() {
    document.querySelectorAll('.req-approve').forEach(btn => btn.addEventListener('click', async () => {
      const requestId = btn.dataset.id;
      const { value: circle } = await Swal.fire({ title: 'اعتماد الطلب', input: 'text', inputLabel: 'اسم الحلقة (اختياري)', inputPlaceholder: 'مثال: حلقة الفاروق' });
      try {
        await api('processRegistrationRequest', { requestId, action: 'approve', circle: circle || '' }, true);
        Swal.fire({ icon: 'success', title: 'تم اعتماد الطلب' });
        await loadStaffDashboard();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'تعذر اعتماد الطلب', text: err.message });
      }
    }));

    document.querySelectorAll('.req-reject').forEach(btn => btn.addEventListener('click', async () => {
      const requestId = btn.dataset.id;
      const { value: reason } = await Swal.fire({ title: 'رفض الطلب', input: 'text', inputLabel: 'سبب الرفض', inputValidator: value => !value && 'السبب مطلوب' });
      if (!reason) return;
      try {
        await api('processRegistrationRequest', { requestId, action: 'reject', rejectReason: reason }, true);
        Swal.fire({ icon: 'success', title: 'تم رفض الطلب' });
        await loadStaffDashboard();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'تعذر رفض الطلب', text: err.message });
      }
    }));
  }

  async function loadStudents() {
    const wrap = document.getElementById('studentsTab');
    try {
      const res = await api('getAllStudents', {}, true);
      wrap.innerHTML = `
        <div class="table-card">
          <h5 class="mb-3">الطلاب</h5>
          <div class="table-responsive"><table class="table align-middle">
            <thead><tr><th>الاسم</th><th>الهوية</th><th>الحلقة</th><th>المرحلة</th><th>الصف</th><th>الحالة</th></tr></thead>
            <tbody>${res.data.map(s => `<tr><td>${s['اسم الطالب ثلاثي']}</td><td>${s['هوية الطالب']}</td><td>${s['الحلقة'] || '-'}</td><td>${s['المرحلة الدراسية'] || '-'}</td><td>${s['الصف الدراسي'] || '-'}</td><td>${s['حالة الطالب'] || '-'}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>`;
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-warning">${err.message}</div>`;
    }
  }

  async function loadWarnings() {
    const wrap = document.getElementById('warningsTab');
    try {
      const res = await api('getWarnings', {}, true);
      wrap.innerHTML = `
        <div class="row g-3">
          <div class="col-lg-8">
            <div class="table-card">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">الإنذارات التعليمية</h5>
                ${canAddWarnings() ? '<button class="btn btn-sm btn-primary" id="addWarningBtn">إضافة إنذار</button>' : ''}
              </div>
              <div class="table-responsive"><table class="table align-middle">
                <thead><tr><th>الطالب</th><th>الهوية</th><th>السبب</th><th>الحالة</th><th>التاريخ</th></tr></thead>
                <tbody>${res.data.educational.map(w => `<tr><td>${w['اسم الطالب']}</td><td>${w['هوية الطالب']}</td><td>${w['سبب الإنذار']}</td><td>${w['حالة الإنذار / الإجراء الحالي']}</td><td>${formatDate(w['تاريخ الإنذار'])}</td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">لا توجد بيانات</td></tr>'}</tbody>
              </table></div>
            </div>
          </div>
          <div class="col-lg-4">
            <div class="panel-card">
              <h6 class="fw-bold">ملخص</h6>
              <p class="mb-2">تأخر: ${res.data.lateness.length}</p>
              <p class="mb-2">غياب: ${res.data.absence.length}</p>
              <p class="mb-0">غياب بعذر: ${res.data.absenceWithExcuse.length}</p>
            </div>
          </div>
        </div>`;
      const addBtn = document.getElementById('addWarningBtn');
      if (addBtn) addBtn.addEventListener('click', onAddWarning);
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-warning">${err.message}</div>`;
    }
  }

  async function onAddWarning() {
    const { value: values } = await Swal.fire({
      title: 'إضافة إنذار تعليمي',
      html: `
        <input id="warn-student-id" class="swal2-input" placeholder="هوية الطالب">
        <input id="warn-reason" class="swal2-input" placeholder="سبب الإنذار">
        <input id="warn-action" class="swal2-input" placeholder="الحالة / الإجراء الحالي">
        <input id="warn-notes" class="swal2-input" placeholder="ملاحظات">
      `,
      preConfirm: () => ({
        studentId: document.getElementById('warn-student-id').value,
        reason: document.getElementById('warn-reason').value,
        actionName: document.getElementById('warn-action').value,
        notes: document.getElementById('warn-notes').value
      })
    });
    if (!values) return;
    try {
      await api('addEducationalWarning', values, true);
      Swal.fire({ icon: 'success', title: 'تمت الإضافة' });
      await loadWarnings();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'تعذر الحفظ', text: err.message });
    }
  }

  async function loadSettings() {
    const wrap = document.getElementById('settingsTab');
    try {
      const res = await api('getSettings', {}, true);
      wrap.innerHTML = `
        <div class="row g-3">
          <div class="col-lg-6">
            <div class="panel-card h-100">
              <div class="d-flex justify-content-between align-items-center mb-3"><h5 class="mb-0">المستخدمون</h5>${canManageSettings() ? '<button class="btn btn-sm btn-primary" id="addUserBtn">إضافة مستخدم</button>' : ''}</div>
              <div class="table-responsive"><table class="table align-middle"><thead><tr><th>الاسم</th><th>الوظيفة</th><th>الدور</th><th>الحالة</th></tr></thead>
              <tbody>${res.data.users.map(u => `<tr><td>${u.name}</td><td>${u.jobTitle || '-'}</td><td>${u.role}</td><td>${u.active}</td></tr>`).join('')}</tbody></table></div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="panel-card h-100">
              <div class="d-flex justify-content-between align-items-center mb-3"><h5 class="mb-0">قوالب الرسائل</h5>${canManageSettings() ? '<button class="btn btn-sm btn-primary" id="addTemplateBtn">إضافة قالب</button>' : ''}</div>
              <div class="small-muted mb-2">عدد القوالب: ${res.data.templates.length}</div>
              ${res.data.templates.map(t => `<div class="border rounded-3 p-2 mb-2"><div class="fw-bold">${t['اسم القالب']}</div><div class="small-muted">${t['نوع القالب']}</div><div>${t['نص القالب']}</div></div>`).join('') || '<div class="text-muted">لا توجد قوالب</div>'}
            </div>
          </div>
        </div>`;
      const addUserBtn = document.getElementById('addUserBtn');
      if (addUserBtn) addUserBtn.addEventListener('click', onAddUser);
      const addTemplateBtn = document.getElementById('addTemplateBtn');
      if (addTemplateBtn) addTemplateBtn.addEventListener('click', onAddTemplate);
    } catch (err) {
      wrap.innerHTML = `<div class="alert alert-warning">${err.message}</div>`;
    }
  }

  async function onAddUser() {
    const { value: v } = await Swal.fire({
      title: 'إضافة مستخدم',
      html: `
        <input id="u-name" class="swal2-input" placeholder="الاسم">
        <input id="u-job" class="swal2-input" placeholder="الوظيفة">
        <input id="u-email" class="swal2-input" placeholder="البريد الإلكتروني">
        <input id="u-code" class="swal2-input" placeholder="رمز الدخول">
        <select id="u-role" class="swal2-input"><option>مدير</option><option>مشرف إداري</option><option>مشرف تعليمي</option><option>معلم</option></select>
      `,
      preConfirm: () => ({
        name: document.getElementById('u-name').value,
        jobTitle: document.getElementById('u-job').value,
        email: document.getElementById('u-email').value,
        code: document.getElementById('u-code').value,
        role: document.getElementById('u-role').value,
        active: 'نعم'
      })
    });
    if (!v) return;
    try {
      await api('saveUser', v, true);
      Swal.fire({ icon: 'success', title: 'تم حفظ المستخدم' });
      await loadSettings();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'تعذر الحفظ', text: err.message });
    }
  }

  async function onAddTemplate() {
    const { value: v } = await Swal.fire({
      title: 'إضافة قالب',
      html: `
        <input id="t-type" class="swal2-input" placeholder="نوع القالب">
        <input id="t-name" class="swal2-input" placeholder="اسم القالب">
        <textarea id="t-text" class="swal2-textarea" placeholder="نص القالب"></textarea>
        <input id="t-vars" class="swal2-input" placeholder="المتغيرات المدعومة">
      `,
      preConfirm: () => ({
        templateType: document.getElementById('t-type').value,
        templateName: document.getElementById('t-name').value,
        templateText: document.getElementById('t-text').value,
        supportedVariables: document.getElementById('t-vars').value
      })
    });
    if (!v) return;
    try {
      await api('saveMessageTemplate', v, true);
      Swal.fire({ icon: 'success', title: 'تم حفظ القالب' });
      await loadSettings();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'تعذر الحفظ', text: err.message });
    }
  }

  function canManageRequests() { return ['مدير', 'مشرف إداري'].includes(state.userRole); }
  function canAddWarnings() { return ['مدير', 'مشرف إداري', 'مشرف تعليمي'].includes(state.userRole); }
  function canManageSettings() { return ['مدير', 'مشرف إداري'].includes(state.userRole); }

  function applyRoleVisibility() {
    const settingsBtn = document.querySelector('[data-tab="settingsTab"]').parentElement;
    const requestsBtn = document.querySelector('[data-tab="requestsTab"]').parentElement;
    const warningsBtn = document.querySelector('[data-tab="warningsTab"]').parentElement;
    settingsBtn.classList.toggle('d-none', !canManageSettings());
    requestsBtn.classList.toggle('d-none', !canManageRequests());
    warningsBtn.classList.toggle('d-none', !['مدير', 'مشرف إداري', 'مشرف تعليمي', 'معلم'].includes(state.userRole));
  }

  document.querySelectorAll('#staffTabs .nav-link').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#staffTabs .nav-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-pane-custom').forEach(t => t.classList.add('d-none'));
    document.getElementById(btn.dataset.tab).classList.remove('d-none');
  }));

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString('ar-SA');
  }

  window.addEventListener('hashchange', route);
  updateAuthUI();
  route();
})();
