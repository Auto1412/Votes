// Admin Email Configuration
const ADMIN_EMAILS = ["xeeaae7@gmail.com"];

// Initialize Supabase
const { createClient } = supabase;

const supabaseClient = createClient(
    "https://onyapxclnfsdgcwisnhx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueWFweGNsbmZzZGdjd2lzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODQzMDksImV4cCI6MjA4NjQ2MDMwOX0.MkzFOJ_Ucs_t7Led5smGsj4deX_rtPbAHXAD_BaI-ns"
);

let endTime = null;
let votingTimer = null;

async function loadVotingStatus() {
    const { data, error } = await supabaseClient
        .from("voting_settings")
        .select("*")
        .eq("id", 1)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    votingActive = data.is_active;
    endTime = data.end_time ? new Date(data.end_time).getTime() : null;

    updateVotingStatusDisplay();

    if (votingActive && endTime) {
        startCountdown();
    }
}

function renderCountdown(remainingMs) {
    const h = Math.floor(remainingMs / 3600000);
    const m = Math.floor((remainingMs % 3600000) / 60000);
    const s = Math.floor((remainingMs % 60000) / 1000);

    const display =
        String(h).padStart(2, "0") + ":" +
        String(m).padStart(2, "0") + ":" +
        String(s).padStart(2, "0");

    const el = document.getElementById("countdown");
    if (el) el.innerText = display;
}

function startCountdown() {
    if (!endTime) return;
    if (votingTimer) clearInterval(votingTimer);

    const tick = () => {
        const remaining = endTime - Date.now();

        if (remaining <= 0) {
            clearInterval(votingTimer);
            votingTimer = null;
            votingActive = false;
            endTime = null;
            updateVotingStatusDisplay();
            return;
        }

        renderCountdown(remaining);
    };

    tick();
    votingTimer = setInterval(tick, 1000);
}

// Global variables
let user = null;
let votingActive = false;
let hasVoted = false;

const voteCounts = { A: 0, B: 0, C: 0 };

// ===============================
// ADMIN CHECK
// ===============================
function isAdmin() {
    return user && ADMIN_EMAILS.includes(user.email);
}

// ===============================
// AUTH
// ===============================
function setupAuthListener() {
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        user = session?.user ?? null;
        updateUIForAuthState();

        if (user) {
            await checkIfUserVoted();
        }
    });
}

function updateUIForAuthState() {
    const loginBtn = document.getElementById("login");
    const userInfo = document.getElementById("user");

    if (user) {
        loginBtn.style.display = "none";
        userInfo.innerText = `👤 ${user.email}`;
        userInfo.style.display = "block";
    } else {
        loginBtn.style.display = "block";
        userInfo.style.display = "none";
    }
}

function setupLoginButton() {
    const loginBtn = document.getElementById("login");
    if (!loginBtn) return;

    loginBtn.onclick = async () => {
        await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin }
        });
    };
}

// ===============================
// LOAD DATA
// ===============================
async function loadCandidatesFromDB() {
    const { data } = await supabaseClient
        .from("candidates")
        .select("*")
        .order("id");

    if (!data) return;

    data.forEach(candidate => {
        voteCounts[candidate.id] = candidate.votes;
        updateVoteDisplay(candidate.id);

        const nameEl = document.getElementById(`name${candidate.id}`);
        if (nameEl) nameEl.innerText = candidate.name;
    });
}

// ===============================
// REALTIME
// ===============================
function setupRealtimeSubscription() {
    supabaseClient
        .channel("realtime_channel")
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "candidates" },
            payload => {
                voteCounts[payload.new.id] = payload.new.votes;
                updateVoteDisplay(payload.new.id);
            }
        )
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "voting_settings" },
            payload => {
                votingActive = payload.new.is_active;
                endTime = payload.new.end_time
                    ? new Date(payload.new.end_time).getTime()
                    : null;

                if (votingActive && endTime) {
                    startCountdown();
                } else if (votingTimer) {
                    clearInterval(votingTimer);
                    votingTimer = null;
                }

                updateVotingStatusDisplay();
            }
        )
        .subscribe();
}

// ===============================
// VOTING STATUS UI
// ===============================
function updateVotingStatusDisplay() {
    const statusDiv = document.getElementById("votingStatus");
    const timerControls = document.getElementById("timerControls");
    const timerDisplay = document.getElementById("timerDisplay");

    if (!statusDiv) return;

    statusDiv.style.display = "block";

    if (votingActive) {
        statusDiv.innerHTML =
            `<div class="voting-status active">
                <span class="status-badge">🟢 การโหวตกำลังเปิด</span>
            </div>`;

        if (timerControls) timerControls.style.display = "none";
        if (timerDisplay) timerDisplay.style.display = "block";
    } else {
        statusDiv.innerHTML =
            `<div class="voting-status inactive">
                <span class="status-badge">🔴 การโหวตปิดอยู่</span>
            </div>`;

        if (timerControls) timerControls.style.display = "block";
        if (timerDisplay) timerDisplay.style.display = "none";
        if (votingTimer) {
            clearInterval(votingTimer);
            votingTimer = null;
        }
        const countdownEl = document.getElementById("countdown");
        if (countdownEl) countdownEl.innerText = "00:00:00";
    }
}

function normalizeTimeInput(inputId, min, max) {
    const input = document.getElementById(inputId);
    if (!input) return 0;

    const rawValue = Number.parseInt(input.value, 10);
    const safeValue = Number.isNaN(rawValue) ? min : Math.min(max, Math.max(min, rawValue));

    input.value = safeValue;
    return safeValue;
}

function applyPreset(hours, minutes, seconds) {
    const hoursInput = document.getElementById("hours");
    const minutesInput = document.getElementById("minutes");
    const secondsInput = document.getElementById("seconds");

    if (!hoursInput || !minutesInput || !secondsInput) return;

    hoursInput.value = String(hours);
    minutesInput.value = String(minutes);
    secondsInput.value = String(seconds);

    normalizeTimeInput("hours", 0, 23);
    normalizeTimeInput("minutes", 0, 59);
    normalizeTimeInput("seconds", 0, 59);
}

function setupPresetButtons() {
    document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            applyPreset(btn.dataset.hours ?? 0, btn.dataset.minutes ?? 0, btn.dataset.seconds ?? 0);
        });
    });
}

function setupTimeInputValidation() {
    [
        { id: "hours", min: 0, max: 23 },
        { id: "minutes", min: 0, max: 59 },
        { id: "seconds", min: 0, max: 59 }
    ].forEach(({ id, min, max }) => {
        const input = document.getElementById(id);
        if (!input) return;

        const normalize = () => normalizeTimeInput(id, min, max);
        input.addEventListener("input", normalize);
        input.addEventListener("change", normalize);
        input.addEventListener("blur", normalize);
    });
}

// ===============================
// CHECK VOTED
// ===============================
async function checkIfUserVoted() {
    if (!user) return;

    const { data } = await supabaseClient
        .from("votes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (data) {
        hasVoted = true;
        disableVotingButtons();
    } else {
        hasVoted = false;
    }
}

// ===============================
// CAST VOTE (RPC)
// ===============================
async function vote(candidateId) {

    if (!votingActive) {
        showStatus("⚠️ การโหวตปิดอยู่", "error");
        return;
    }

    if (!user) {
        showStatus("⚠️ กรุณาเข้าสู่ระบบก่อนโหวต", "error");
        return;
    }

    if (hasVoted) {
        showStatus("⚠️ คุณโหวตแล้ว", "error");
        return;
    }

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
// ADMIN CONTROLS (RPC)
// ===============================
async function startVoting() {
    if (!isAdmin()) {
        alert("คุณไม่ใช่ admin");
        return;
    }

    const hours = normalizeTimeInput("hours", 0, 23);
    const minutes = normalizeTimeInput("minutes", 0, 59);
    const seconds = normalizeTimeInput("seconds", 0, 59);

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (totalSeconds <= 0) {
        alert("ตั้งเวลามากกว่า 0");
        return;
    }

    const { error: resetError } = await supabaseClient.rpc("reset_voting");
    if (resetError) {
        console.error(resetError);
        alert("Reset ไม่สำเร็จ");
        return;
    }

    const { error: openError } = await supabaseClient.rpc("open_voting", {
        duration_seconds: totalSeconds
    });

    if (openError) {
        console.error(openError);
        alert("Open voting ไม่สำเร็จ");
        return;
    }

    await loadCandidatesFromDB();
    await loadVotingStatus();

    alert("เปิดโหวตสำเร็จ");
}

async function stopVoting() {
    if (!isAdmin()) return;

    await supabaseClient.rpc("close_voting");
}

// ===============================
// UI HELPERS
// ===============================
function disableVotingButtons() {
    ["A", "B", "C"].forEach(id => {
        const btn = document.getElementById("btn" + id);
        if (btn) btn.disabled = true;
    });
}

function updateVoteDisplay(id) {
    const el = document.getElementById("vote" + id);
    if (el) el.innerText = voteCounts[id];
}

function showStatus(message, type = "info") {
    const statusDiv = document.getElementById("status");
    if (!statusDiv) return;

    statusDiv.innerText = message;
    statusDiv.className = `status-message ${type}`;

    setTimeout(() => {
        statusDiv.innerText = "";
        statusDiv.className = "status-message";
    }, 4000);
}

// ===============================
// INIT
// ===============================
async function init() {
    setupAuthListener();
    setupLoginButton();
    setupPresetButtons();
    setupTimeInputValidation();

    // ✅ ผูกปุ่มเริ่มโหวต
    const startBtn = document.getElementById("startTimer");
    if (startBtn) {
        startBtn.addEventListener("click", startVoting);
    }

    // ✅ ผูกปุ่มหยุดโหวต
    const stopBtn = document.getElementById("stopTimer");
    if (stopBtn) {
        stopBtn.addEventListener("click", stopVoting);
    }

    await loadCandidatesFromDB();
    await loadVotingStatus();
    setupRealtimeSubscription();
}

window.vote = vote;
window.startVoting = startVoting;
window.stopVoting = stopVoting;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
