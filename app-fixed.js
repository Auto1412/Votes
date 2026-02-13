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
    const { data } = await supabaseClient
        .from("voting_settings")
        .select("*")
        .eq("id", 1)
        .single();

    if (!data) return;

    votingActive = data.is_active;
    endTime = data.end_time ? new Date(data.end_time).getTime() : null;

    updateVotingStatusDisplay();

    if (votingActive && endTime) {
        startCountdown();
    }
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

        const display = 
            String(h).padStart(2, '0') + ":" +
            String(m).padStart(2, '0') + ":" +
            String(s).padStart(2, '0');

        const el = document.getElementById("countdown");
        if (el) el.innerText = display;

    }, 1000);
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

async function loadVotingStatus() {
    const { data } = await supabaseClient
        .from("voting_settings")
        .select("*")
        .eq("id", 1)
        .single();

    if (!data) return;

    votingActive = data.is_active;
    updateVotingStatusDisplay();
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
    if (!statusDiv) return;

    if (votingActive) {
        statusDiv.innerHTML =
            `<div class="voting-status active">
                🟢 การโหวตกำลังเปิด
            </div>`;
    } else {
        statusDiv.innerHTML =
            `<div class="voting-status inactive">
                🔴 การโหวตปิดอยู่
            </div>`;
    }
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
    if (!isAdmin()) return;

    const hours = parseInt(document.getElementById("hours").value) || 0;
    const minutes = parseInt(document.getElementById("minutes").value) || 0;
    const seconds = parseInt(document.getElementById("seconds").value) || 0;

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (totalSeconds <= 0) {
        alert("ตั้งเวลามากกว่า 0");
        return;
    }

    await supabaseClient.rpc("reset_voting");
    await supabaseClient.rpc("open_voting", {
        duration_seconds: totalSeconds
    });

    await loadCandidatesFromDB();
    await loadVotingStatus();
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
