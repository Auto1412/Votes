// ===============================
// ADMIN EMAIL CONFIG
// ===============================
const ADMIN_EMAILS = ["xeeaae7@gmail.com"];

// ===============================
// SUPABASE INIT
// ===============================
const { createClient } = supabase;

const supabaseClient = createClient(
  "https://onyapxclnfsdgcwisnhx.supabase.co",
  "YOUR_PUBLIC_ANON_KEY"
);

// ===============================
// GLOBAL STATE
// ===============================
let user = null;
let votingActive = false;
let hasVoted = false;
let voteCounts = {};
let endTime = null;
let votingTimer = null;

// ===============================
// AUTH
// ===============================
function isAdmin() {
  return user && ADMIN_EMAILS.includes(user.email);
}

function setupAuthListener() {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    user = session?.user ?? null;
    checkIfUserVoted();
  });
}

function setupLoginButton() {
  const btn = document.getElementById("loginBtn");
  if (!btn) return;

  btn.onclick = async () => {
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });
  };
}

// ===============================
// VOTING STATUS
// ===============================
async function loadVotingStatus() {
  const { data, error } = await supabaseClient
    .from("voting_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) return;

  votingActive = data.is_active;
  endTime = data.end_time ? new Date(data.end_time).getTime() : null;

  updateVotingStatusDisplay();

  if (votingActive && endTime) startCountdown();
}

function startCountdown() {
  if (votingTimer) clearInterval(votingTimer);

  votingTimer = setInterval(() => {
    const remaining = endTime - Date.now();

    if (remaining <= 0) {
      clearInterval(votingTimer);
      votingActive = false;
      updateVotingStatusDisplay();
      return;
    }

    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);

    const el = document.getElementById("countdown");
    if (el) {
      el.innerText =
        String(h).padStart(2, "0") + ":" +
        String(m).padStart(2, "0") + ":" +
        String(s).padStart(2, "0");
    }
  }, 1000);
}

// ===============================
// UI
// ===============================
function updateVotingStatusDisplay() {
  const statusDiv = document.getElementById("votingStatus");
  const timerDisplay = document.getElementById("timerDisplay");
  const timerControls = document.getElementById("timerControls");

  if (!statusDiv) return;

  if (votingActive) {
    statusDiv.innerHTML = `<span class="status-badge">🟢 การโหวตกำลังเปิด</span>`;
    if (timerDisplay) timerDisplay.style.display = "block";
    if (timerControls) timerControls.style.display = "none";
  } else {
    statusDiv.innerHTML = `<span class="status-badge">🔴 การโหวตปิดอยู่</span>`;
    if (timerDisplay) timerDisplay.style.display = "none";
    if (timerControls) timerControls.style.display = "block";
    const el = document.getElementById("countdown");
    if (el) el.innerText = "00:00:00";
  }
}

// ===============================
// CANDIDATES
// ===============================
async function loadCandidatesFromDB() {
  const { data } = await supabaseClient
    .from("candidates")
    .select("*")
    .order("id");

  if (!data) return;

  data.forEach(c => {
    voteCounts[c.id] = c.votes;
    updateVoteDisplay(c.id);

    const nameEl = document.getElementById(`name${c.id}`);
    if (nameEl) nameEl.innerText = c.name;
  });
}

// ===============================
// REALTIME
// ===============================
function setupRealtimeSubscription() {
  supabaseClient
    .channel("realtime")
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "candidates" },
      payload => {
        voteCounts[payload.new.id] = payload.new.votes;
        updateVoteDisplay(payload.new.id);
      }
    )
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "voting_settings" },
      payload => {
        votingActive = payload.new.is_active;
        endTime = payload.new.end_time
          ? new Date(payload.new.end_time).getTime()
          : null;

        if (votingActive && endTime) startCountdown();
        else if (votingTimer) clearInterval(votingTimer);

        updateVotingStatusDisplay();
      }
    )
    .subscribe();
}

// ===============================
// VOTE
// ===============================
async function checkIfUserVoted() {
  if (!user) return;

  const { data } = await supabaseClient
    .from("votes")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  hasVoted = !!data;
  if (hasVoted) disableVotingButtons();
}

async function vote(candidateId) {
  if (!votingActive || hasVoted) return;

  const { error } = await supabaseClient.rpc("cast_vote", {
    cid: candidateId
  });

  if (error) {
    showStatus("❌ " + error.message, "error");
    return;
  }

  hasVoted = true;
  disableVotingButtons();
  showStatus("✓ โหวตสำเร็จ!", "success");
}

// ===============================
// ADMIN
// ===============================
function normalizeTimeInput(id, min, max) {
  const el = document.getElementById(id);
  const v = parseInt(el.value) || 0;
  el.value = Math.min(max, Math.max(min, v));
  return el.value;
}

async function startVoting() {
  if (!isAdmin()) return alert("คุณไม่ใช่ admin");

  const h = normalizeTimeInput("hours", 0, 23);
  const m = normalizeTimeInput("minutes", 0, 59);
  const s = normalizeTimeInput("seconds", 0, 59);

  const total = h * 3600 + m * 60 + s;
  if (total <= 0) return alert("ตั้งเวลามากกว่า 0");

  await supabaseClient.rpc("reset_voting");
  await supabaseClient.rpc("open_voting", {
    duration_seconds: total
  });
}

// ===============================
// HELPERS
// ===============================
function updateVoteDisplay(id) {
  const el = document.getElementById("vote" + id);
  if (el) el.innerText = voteCounts[id];
}

function disableVotingButtons() {
  document.querySelectorAll(".vote-btn").forEach(b => b.disabled = true);
}

function showStatus(msg, type) {
  const el = document.getElementById("status");
  if (!el) return;

  el.innerText = msg;
  el.className = `status-message ${type}`;
  setTimeout(() => el.innerText = "", 4000);
}

// ===============================
// INIT
// ===============================
async function init() {
  setupAuthListener();
  setupLoginButton();
  await loadCandidatesFromDB();
  await loadVotingStatus();
  setupRealtimeSubscription();
}

document.addEventListener("DOMContentLoaded", init);

window.vote = vote;
window.startVoting = startVoting;
