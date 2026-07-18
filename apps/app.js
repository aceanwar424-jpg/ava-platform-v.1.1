// ═══════════════════════════════════════════
// MOBILE APPS - Logic & Interactivity
// ═══════════════════════════════════════════

// Switch Screens
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

// Handle Login Submission
function handleLogin(event) {
  event.preventDefault();
  
  const usernameInput = document.getElementById('username').value.trim();
  const selectedRole = document.querySelector('input[name="login-role"]:checked').value;
  
  // Set Profile info based on role
  const avatarEl = document.getElementById('user-avatar');
  const welcomeEl = document.getElementById('user-welcome');
  const roleBadgeEl = document.getElementById('user-role-badge');
  
  if (selectedRole === 'doctor') {
    avatarEl.textContent = 'D';
    avatarEl.style.background = 'linear-gradient(135deg, #14b8a6, #0d9488)';
    welcomeEl.textContent = `dr. ${usernameInput || 'Spesialis'}`;
    roleBadgeEl.textContent = 'Dokter Aktif';
    roleBadgeEl.style.color = '#14b8a6';
    
    // Switch views
    document.getElementById('patient-view').classList.remove('active');
    document.getElementById('doctor-view').classList.add('active');
  } else {
    avatarEl.textContent = 'P';
    avatarEl.style.background = 'linear-gradient(135deg, #0ea5e9, #0284c7)';
    welcomeEl.textContent = usernameInput || 'Pasien AvaHealth';
    roleBadgeEl.textContent = 'Pasien Terverifikasi';
    roleBadgeEl.style.color = '#38bdf8';
    
    // Switch views
    document.getElementById('doctor-view').classList.remove('active');
    document.getElementById('patient-view').classList.add('active');
  }
  
  // Go to dashboard
  showScreen('dashboard-screen');
}

// Logout
function handleLogout() {
  // Clear username & password inputs
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  
  // Show login screen
  showScreen('login-screen');
}
