// Admin Email Configuration
const ADMIN_EMAILS = ["xeeaae7@gmail.com"];

// Initialize Supabase
const { createClient } = supabase;

const supabaseClient = createClient(
    "https://onyapxclnfsdgcwisnhx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueWFweGNsbmZzZGdjd2lzbmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODQzMDksImV4cCI6MjA4NjQ2MDMwOX0.MkzFOJ_Ucs_t7Led5smGsj4deX_rtPbAHXAD_BaI-ns"
);

// Global variables
let user = null;
let votingTimer = null;
let votingActive = false;
let hasVoted = false;
let endTime = null;

// Vote counts (local state)
const voteCounts = {
    A: 0,
    B: 0,
    C: 0
};

// Check if user is admin
function isAdmin() {
    return user && ADMIN_EMAILS.includes(user.email);
}

// Auth Management
function setupAuthListener() {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        user = session?.user ?? null;
        updateUIForAuthState();
        if (user) {
            checkIfUserVoted();
            updateTimerVisibility();
            updateVotingStatusDisplay();
        }
    });
}

function updateUIForAuthState() {
    const loginBtn = document.getElementById("login");
    const userInfo = document.getElementById("user");

    if (user) {
        loginBtn.style.display = "none";
        userInfo.innerText = `👤 เข้าสู่ระบบ: ${user.email}`;
        userInfo.style.display = "block";
    } else {
        loginBtn.style.display = "block";
        userInfo.style.display = "none";
    }
}

// Update voting status display for all users
function updateVotingStatusDisplay() {
    const statusDiv = document.getElementById("votingStatus");
    if (!statusDiv) return;

    if (votingActive) {
        statusDiv.innerHTML = `
            <div class="voting-status active">
                <span class="status-badge">🟢 การโหวตกำลังดำเนิน</span>
                <div class="countdown-display" id="statusCountdown">00:30:00</div>
            </div>
        `;
        statusDiv.style.display = "block";
    } else {
        statusDiv.innerHTML = `<div class="voting-status inactive"><span class="status-badge">⚪ การโหวตยังไม่เริ่ม</span></div>`;
        statusDiv.style.display = "block";
    }
}

// Update timer section visibility based on admin status
function updateTimerVisibility() {
    const timerControls = document.getElementById("timerControls");
    
    if (isAdmin()) {
        if (timerControls) timerControls.style.display = "block";
    } else {
        if (timerControls) timerControls.style.display = "none";
    }
}

// Login handler
function setupLoginButton() {
    const loginBtn = document.getElementById("login");
    if (loginBtn) {
        loginBtn.onclick = async () => {
            try {
                const { data, error } = await supabaseClient.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                        redirectTo: "https://votes-olive.vercel.app"
                    }
                });
                if (error) throw error;
            } catch (error) {
                console.error("Login error:", error);
                showStatus("เกิดข้อผิดพลาดในการเข้าสู่ระบบ: " + error.message, "error");
            }
        };
    }
}

// Check if user has already voted
async function checkIfUserVoted() {
    if (!user) return;

    try {
        const { data, error } = await supabaseClient
            .from("votes")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Error checking vote:", error);
            return;
        }

        if (data) {
            hasVoted = true;
            disableVotingButtons();
            showStatus("✓ คุณได้ทำการโหวตไปแล้ว", "info");
        } else {
            hasVoted = false;
        }
    } catch (error) {
        console.error("Error checking vote:", error);
        hasVoted = false;
    }
}

// Timer Controls
function setupTimerControls() {
    const startBtn = document.getElementById("startTimer");
    const stopBtn = document.getElementById("stopTimer");
    
    if (startBtn) startBtn.onclick = startVoting;
    if (stopBtn) stopBtn.onclick = stopVoting;
    
    // Setup preset buttons
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const hours = parseInt(this.getAttribute('data-hours'));
            const minutes = parseInt(this.getAttribute('data-minutes'));
            const seconds = parseInt(this.getAttribute('data-seconds'));
            setQuickTime(hours, minutes, seconds);
        });
    });
    
    // Restore saved timer values
    restoreSavedTimer();
}

// Quick time setter function
function setQuickTime(hours, minutes, seconds) {
    if (!isAdmin()) {
        showStatus("⚠️ เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถตั้งเวลา", "error");
        return;
    }
    
    document.getElementById("hours").value = hours;
    document.getElementById("minutes").value = minutes;
    document.getElementById("seconds").value = seconds;
    
    // Save immediately
    localStorage.setItem("timerHours", hours);
    localStorage.setItem("timerMinutes", minutes);
    localStorage.setItem("timerSeconds", seconds);
    
    const timeText = `${hours > 0 ? hours + ' ชม. ' : ''}${minutes > 0 ? minutes + ' นาที' : ''}${seconds > 0 ? seconds + ' วินาที' : ''}`;
    showStatus(`⏱️ ตั้งเวลา ${timeText}`, "success");
}

// Restore saved timer settings and state
function restoreSavedTimer() {
    // Restore timer input values
    const savedHours = localStorage.getItem("timerHours");
    const savedMinutes = localStorage.getItem("timerMinutes");
    const savedSeconds = localStorage.getItem("timerSeconds");
    
    if (savedHours) document.getElementById("hours").value = savedHours;
    if (savedMinutes) document.getElementById("minutes").value = savedMinutes;
    if (savedSeconds) document.getElementById("seconds").value = savedSeconds;
    
    // Check if there was an active voting session
    const wasVotingActive = localStorage.getItem("votingActive") === "true";
    const savedEndTime = parseInt(localStorage.getItem("endTime"));
    
    if (wasVotingActive && savedEndTime) {
        const now = Date.now();
        
        // If voting session hasn't ended yet, resume it
        if (savedEndTime > now) {
            votingActive = true;
            endTime = savedEndTime;
            
            // Show timer display
            document.getElementById("timerControls").style.display = "none";
            document.getElementById("timerDisplay").style.display = "block";
            document.getElementById("results").style.display = "none";
            document.getElementById("candidatesSection").classList.remove("voting-closed");
            
            updateVotingStatusDisplay();
            showStatus("🔄 กลับมาที่เซสชันโหวต", "info");
            
            // Resume countdown
            updateCountdown();
            votingTimer = setInterval(updateCountdown, 1000);
        } else {
            // Voting session has ended, show results
            endVoting();
        }
    }
}

async function startVoting() {
    if (!isAdmin()) {
        showStatus("⚠️ เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเริ่มการโหวต", "error");
        return;
    }
    
    const hours = parseInt(document.getElementById("hours").value) || 0;
    const minutes = parseInt(document.getElementById("minutes").value) || 0;
    const seconds = parseInt(document.getElementById("seconds").value) || 0;

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (totalSeconds <= 0) {
        showStatus("⚠️ กรุณาตั้งเวลามากกว่า 0", "error");
        return;
    }

    // Clear old votes and reset vote counts
    try {
        const { error: deleteError } = await supabaseClient
            .from("votes")
            .delete()
            .neq("user_id", "");

        if (deleteError) {
            console.error("Error clearing votes:", deleteError);
        }

        // Reset vote counts in database
        const { error: resetError } = await supabaseClient
            .from("candidates")
            .update({ votes: 0 })
            .neq("id", "");

        if (resetError) {
            console.error("Error resetting votes:", resetError);
        }
    } catch (error) {
        console.error("Error during reset:", error);
    }

    // Reset local state
    voteCounts.A = 0;
    voteCounts.B = 0;
    voteCounts.C = 0;
    hasVoted = false;
    
    // Update vote display
    updateVoteDisplay("A");
    updateVoteDisplay("B");
    updateVoteDisplay("C");
    
    // Re-enable voting buttons
    const btnA = document.getElementById("btnA");
    const btnB = document.getElementById("btnB");
    const btnC = document.getElementById("btnC");
    if (btnA) btnA.disabled = false;
    if (btnB) btnB.disabled = false;
    if (btnC) btnC.disabled = false;

    // Save timer settings
    localStorage.setItem("timerHours", hours);
    localStorage.setItem("timerMinutes", minutes);
    localStorage.setItem("timerSeconds", seconds);

    votingActive = true;
    endTime = Date.now() + totalSeconds * 1000;
    
    // Save voting state
    localStorage.setItem("votingActive", "true");
    localStorage.setItem("endTime", endTime);
    localStorage.removeItem("voteCounts");

    // Show timer display, hide controls
    document.getElementById("timerControls").style.display = "none";
    document.getElementById("timerDisplay").style.display = "block";
    document.getElementById("results").style.display = "none";
    document.getElementById("candidatesSection").classList.remove("voting-closed");

    updateVotingStatusDisplay();
    showStatus("🗳️ การโหวตเริ่มแล้ว!", "success");

    // Start countdown
    updateCountdown();
    votingTimer = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);

    if (remaining <= 0) {
        endVoting();
        return;
    }

    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const display = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    document.getElementById("countdown").innerText = display;
    
    // Update status countdown for all users
    const statusCountdown = document.getElementById("statusCountdown");
    if (statusCountdown) {
        statusCountdown.innerText = display;
    }

    // Warning when less than 1 minute
    if (remaining < 60000) {
        document.getElementById("countdown").style.color = "#dc3545";
        if (statusCountdown) statusCountdown.style.color = "#dc3545";
    } else {
        document.getElementById("countdown").style.color = "#667eea";
        if (statusCountdown) statusCountdown.style.color = "#667eea";
    }
}

function pad(num) {
    return num.toString().padStart(2, "0");
}

function stopVoting() {
    if (!isAdmin()) {
        showStatus("⚠️ เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถหยุดการโหวต", "error");
        return;
    }
    
    if (confirm("คุณต้องการหยุดการโหวตและประกาศผลใช่หรือไม่?")) {
        endVoting();
    }
}

function endVoting() {
    clearInterval(votingTimer);
    votingActive = false;
    
    // Clear saved voting state
    localStorage.removeItem("votingActive");
    localStorage.removeItem("endTime");

    // Hide timer, show results
    document.getElementById("timerDisplay").style.display = "none";
    document.getElementById("timerControls").style.display = "block";

    // Disable voting
    document.getElementById("candidatesSection").classList.add("voting-closed");
    disableVotingButtons();

    updateVotingStatusDisplay();
    
    // Show results
    showResults();
}

// Voting Function
async function vote(candidateId) {
    console.log("Vote clicked for:", candidateId);
    console.log("Voting active:", votingActive);
    console.log("User:", user);
    console.log("Has voted:", hasVoted);

    if (!votingActive) {
        showStatus("⚠️ การโหวตยังไม่เริ่ม หรือสิ้นสุดไปแล้ว", "error");
        return;
    }

    if (!user) {
        showStatus("⚠️ กรุณาเข้าสู่ระบบก่อนโหวต", "error");
        return;
    }

    if (hasVoted) {
        showStatus("⚠️ คุณได้ทำการโหวตไปแล้ว", "error");
        return;
    }

    try {
        // Double-check if user has already voted in database
        const { data: existingVote, error: checkError } = await supabaseClient
            .from("votes")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

        if (existingVote) {
            hasVoted = true;
            disableVotingButtons();
            showStatus("⚠️ คุณได้ทำการโหวตไปแล้ว", "error");
            return;
        }

        // Record vote in database
        const { data: voteData, error: voteError } = await supabaseClient
            .from("votes")
            .insert({
                user_id: user.id,
                candidate_id: candidateId,
                user_email: user.email
            })
            .select();

        if (voteError) {
            console.error("Vote error:", voteError);
            if (voteError.code === '23505') {
                // Unique constraint violation
                hasVoted = true;
                disableVotingButtons();
                showStatus("⚠️ คุณได้ทำการโหวตไปแล้ว", "error");
            } else {
                showStatus("❌ เกิดข้อผิดพลาด: " + voteError.message, "error");
            }
            return;
        }

        console.log("Vote recorded:", voteData);

        // Increment vote count in database
        const { data: rpcData, error: incrementError } = await supabaseClient
            .rpc("increment_vote", { cid: candidateId });

        if (incrementError) {
            console.error("Increment error:", incrementError);
            // Continue anyway - update local count
        }

        // Update local count
        voteCounts[candidateId]++;
        updateVoteDisplay(candidateId);

        hasVoted = true;
        disableVotingButtons();
        showStatus("✓ โหวตสำเร็จ! ขอบคุณที่ร่วมลงคะแนน", "success");

    } catch (error) {
        console.error("Error details:", error);
        showStatus("❌ เกิดข้อผิดพลาด: " + error.message, "error");
    }
}

function disableVotingButtons() {
    const btnA = document.getElementById("btnA");
    const btnB = document.getElementById("btnB");
    const btnC = document.getElementById("btnC");
    
    if (btnA) btnA.disabled = true;
    if (btnB) btnB.disabled = true;
    if (btnC) btnC.disabled = true;
}

// Load vote counts from database
async function loadCandidatesFromDB() {
    try {
        const { data, error } = await supabaseClient
            .from("candidates")
            .select("*")
            .order("id");

        if (error) {
            console.error("Error loading candidates:", error);
            return;
        }

        if (data && data.length > 0) {
            console.log("Loaded candidates:", data);
            data.forEach(candidate => {
                voteCounts[candidate.id] = candidate.votes || 0;
                updateVoteDisplay(candidate.id);
                
                // Update name if exists
                const nameElement = document.getElementById(`name${candidate.id}`);
                if (nameElement && candidate.name) {
                    nameElement.innerText = candidate.name;
                }
            });
        }
    } catch (error) {
        console.error("Error in loadCandidatesFromDB:", error);
    }
}

function updateVoteDisplay(candidateId) {
    const element = document.getElementById(`vote${candidateId}`);
    if (element) {
        element.innerText = voteCounts[candidateId];
    }
}

// Setup Realtime Subscription
function setupRealtimeSubscription() {
    // Listen to candidates table for vote count updates
    supabaseClient
        .channel("candidates_channel")
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "candidates"
            },
            (payload) => {
                console.log("Vote count updated:", payload);
                const candidateId = payload.new.id;
                if (voteCounts[candidateId] !== undefined) {
                    voteCounts[candidateId] = payload.new.votes;
                    updateVoteDisplay(candidateId);
                }
            }
        )
        .subscribe((status) => {
            console.log("Candidates channel status:", status);
        });
}

// Show Results
function showResults() {
    const resultsSection = document.getElementById("results");
    const winnerDiv = document.getElementById("winner");
    const finalResultsDiv = document.getElementById("finalResults");

    resultsSection.style.display = "block";

    // Find winner
    const candidates = [
        { id: "A", name: document.getElementById("nameA").innerText, votes: voteCounts.A },
        { id: "B", name: document.getElementById("nameB").innerText, votes: voteCounts.B },
        { id: "C", name: document.getElementById("nameC").innerText, votes: voteCounts.C }
    ];

    candidates.sort((a, b) => b.votes - a.votes);
    const winner = candidates[0];
    const totalVotes = voteCounts.A + voteCounts.B + voteCounts.C;

    // Display winner
    winnerDiv.innerHTML = `
        <h3>🎉 ผู้ชนะการเลือกตั้ง</h3>
        <h2 style="font-size: 2.5em; color: #667eea; margin: 20px 0;">${winner.name}</h2>
        <p style="font-size: 1.3em;">ได้รับคะแนนโหวต: <strong>${winner.votes}</strong> คะแนน</p>
        <p style="color: #666;">จากทั้งหมด ${totalVotes} คะแนน</p>
    `;

    // Display all results
    finalResultsDiv.innerHTML = candidates.map((candidate, index) => {
        const percentage = totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(1) : 0;
        const isWinner = index === 0;
        
        return `
            <div class="result-item ${isWinner ? 'winner-item' : ''}">
                <div>
                    <h3>${isWinner ? '🥇' : index === 1 ? '🥈' : '🥉'} ${candidate.name}</h3>
                    <p style="color: #666;">อันดับที่ ${index + 1}</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 2em; font-weight: bold; color: #667eea;">${candidate.votes}</p>
                    <p style="color: #666;">${percentage}%</p>
                </div>
            </div>
        `;
    }).join("");

    showStatus("🏁 การโหวตสิ้นสุดแล้ว", "info");
}

// Status Message Helper
function showStatus(message, type = "info") {
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
        statusDiv.innerText = message;
        statusDiv.className = `status-message ${type}`;
        
        setTimeout(() => {
            if (statusDiv.innerText === message) {
                statusDiv.innerText = "";
                statusDiv.className = "status-message";
            }
        }, 5000);
    }
}

// Initialize app
async function init() {
    console.log("Initializing app...");
    
    setupAuthListener();
    setupLoginButton();
    setupTimerControls();
    await loadCandidatesFromDB();
    setupRealtimeSubscription();
    updateVotingStatusDisplay();
    
    console.log("App initialized!");
}

// Make vote function global
window.vote = vote;

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
