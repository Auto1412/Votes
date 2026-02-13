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
+
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
 
function setupLoginButton() {
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
 
-async function loadVotingStatus() {
-    const { data } = await supabaseClient
-        .from("voting_settings")
-        .select("*")
-        .eq("id", 1)
-        .single();
-
-    if (!data) return;
-
-    votingActive = data.is_active;
-    updateVotingStatusDisplay();
-}
-
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
+                endTime = payload.new.end_time
+                    ? new Date(payload.new.end_time).getTime()
+                    : null;
+
+                if (votingActive && endTime) {
+                    startCountdown();
+                } else if (votingTimer) {
+                    clearInterval(votingTimer);
+                }
+
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
+    const timerControls = document.getElementById("timerControls");
+    const timerDisplay = document.getElementById("timerDisplay");
+
     if (!statusDiv) return;
 
+    statusDiv.style.display = "block";
+
     if (votingActive) {
         statusDiv.innerHTML =
             `<div class="voting-status active">
-                🟢 การโหวตกำลังเปิด
+                <span class="status-badge">🟢 การโหวตกำลังเปิด</span>
             </div>`;
+
+        if (timerControls) timerControls.style.display = "none";
+        if (timerDisplay) timerDisplay.style.display = "block";
     } else {
         statusDiv.innerHTML =
             `<div class="voting-status inactive">
-                🔴 การโหวตปิดอยู่
+                <span class="status-badge">🔴 การโหวตปิดอยู่</span>
             </div>`;
+
+        if (timerControls) timerControls.style.display = "block";
+        if (timerDisplay) timerDisplay.style.display = "none";
+        const countdownEl = document.getElementById("countdown");
+        if (countdownEl) countdownEl.innerText = "00:00:00";
     }
 }
 
+function normalizeTimeInput(inputId, min, max) {
+    const input = document.getElementById(inputId);
+    if (!input) return 0;
+
+    const rawValue = Number.parseInt(input.value, 10);
+    const safeValue = Number.isNaN(rawValue) ? min : Math.min(max, Math.max(min, rawValue));
+
+    input.value = safeValue;
+    return safeValue;
+}
+
+function applyPreset(hours, minutes, seconds) {
+    const hoursInput = document.getElementById("hours");
+    const minutesInput = document.getElementById("minutes");
+    const secondsInput = document.getElementById("seconds");
+
+    if (!hoursInput || !minutesInput || !secondsInput) return;
+
+    hoursInput.value = hours;
+    minutesInput.value = minutes;
+    secondsInput.value = seconds;
+}
+
+function setupPresetButtons() {
+    document.querySelectorAll(".preset-btn").forEach(btn => {
+        btn.addEventListener("click", () => {
+            applyPreset(btn.dataset.hours ?? 0, btn.dataset.minutes ?? 0, btn.dataset.seconds ?? 0);
+        });
+    });
+}
+
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
 
async function vote(candidateId) {
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
 
       const hours = parseInt(document.getElementById("hours").value) || 0;
  const minutes = parseInt(document.getElementById("minutes").value) || 0;
  const seconds = parseInt(document.getElementById("seconds").value) || 0;
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
 
function disableVotingButtons() {
 
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
 
EOF
)
