// =========================================
// VERSION 1413 - Complete JavaScript
// Dynamic Candidate Management + Voting Session
// =========================================

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
let sessionCheckInterval = null;

// VERSION 1413: Dynamic candidates
let allCandidates = [];
const voteCounts = {}; // Will be populated dynamically

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

// Update timer section visibility based on admin status
function updateTimerVisibility() {
    const timerControls = document.getElementById("timerControls");
    const candidateManagement = document.getElementById("candidateManagement");
    
    if (isAdmin()) {
        if (timerControls) timerControls.style.display = "block";
        if (candidateManagement) candidateManagement.style.display = "block";
    } else {
        if (timerControls) timerControls.style.display = "none";
        if (candidateManagement) candidateManagement.style.display = "none";
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
                        redirectTo: window.location.origin
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

        if (error) throw error;

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

// Restore saved timer settings - VERSION 1413 (simplified)
function restoreSavedTimer() {
    // Restore timer input values only
    const savedHours = localStorage.getItem("timerHours");
    const savedMinutes = localStorage.getItem("timerMinutes");
    const savedSeconds = localStorage.getItem("timerSeconds");
    
    if (savedHours) document.getElementById("hours").value = savedHours;
    if (savedMinutes) document.getElementById("minutes").value = savedMinutes;
    if (savedSeconds) document.getElementById("seconds").value = savedSeconds;
    
    // Note: Voting session state is loaded from database in init()
}

function startVoting() {
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

    // Confirm before resetting and starting
    if (!confirm("เริ่มการโหวตใหม่?\n\n⚠️ ระบบจะรีเซ็ตคะแนนทั้งหมดและเริ่มนับใหม่")) {
        return;
    }

    // Reset votes before starting
    resetVotesAndStart(hours, minutes, seconds, totalSeconds);
}

// New function: Reset votes then start voting - VERSION 1413
async function resetVotesAndStart(hours, minutes, seconds, totalSeconds) {
    try {
        showStatus("🔄 กำลังรีเซ็ตและเริ่มการโหวต...", "info");
        
        // Call reset_votes RPC function
        const { error: resetError } = await supabaseClient.rpc("reset_votes");
        
        if (resetError) {
            console.error("Reset error:", resetError);
            throw resetError;
        }
        
        console.log("✅ Reset successful, starting new session...");
        
        // Reset local state for all candidates
        allCandidates.forEach(candidate => {
            voteCounts[candidate.id] = 0;
            updateVoteDisplay(candidate.id);
        });
        
        hasVoted = false;
        
        // Enable voting buttons for everyone
        enableVotingButtons();
        
        // VERSION 1412: Start session in database
        const { error: sessionError } = await supabaseClient
            .rpc("start_voting_session", {
                duration_seconds: totalSeconds,
                admin_email: user?.email || "admin"
            });
        
        if (sessionError) {
            console.error("Session start error:", sessionError);
            throw sessionError;
        }
        
        // Update local state
        votingActive = true;
        endTime = Date.now() + totalSeconds * 1000;
        
        // Save timer settings (for UI only)
        localStorage.setItem("timerHours", hours);
        localStorage.setItem("timerMinutes", minutes);
        localStorage.setItem("timerSeconds", seconds);

        // Show timer display, hide controls and results
        document.getElementById("timerControls").style.display = "none";
        document.getElementById("timerDisplay").style.display = "block";
        document.getElementById("results").style.display = "none";
        document.getElementById("candidatesSection").classList.remove("voting-closed");

        showStatus("🗳️ รีเซ็ตเสร็จสิ้น! การโหวตเริ่มแล้ว", "success");

        // Start countdown
        updateCountdown();
        if (votingTimer) clearInterval(votingTimer);
        votingTimer = setInterval(updateCountdown, 1000);
        
        // Reload data to confirm and recheck vote status
        await loadCandidatesFromDB();
        
        if (user) {
            await checkIfUserVoted();
        }
        
    } catch (error) {
        console.error("Error resetting and starting:", error);
        showStatus("❌ เกิดข้อผิดพลาด: " + error.message, "error");
    }
}

function updateCountdown() {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);

    if (remaining <= 0) {
        stopVotingSession();
        return;
    }

    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const display = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    document.getElementById("countdown").innerText = display;

    // Warning when less than 1 minute
    if (remaining < 60000) {
        document.getElementById("countdown").style.color = "#dc3545";
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
        stopVotingSession();
    }
}

async function stopVotingSession() {
    try {
        // Update database
        const { error } = await supabaseClient.rpc("stop_voting_session");
        
        if (error) {
            console.error("Error stopping session:", error);
        }
        
        endVoting();
    } catch (error) {
        console.error("Error in stopVotingSession:", error);
        endVoting();
    }
}

function endVoting() {
    clearInterval(votingTimer);
    votingActive = false;

    // Hide timer, show results
    document.getElementById("timerDisplay").style.display = "none";
    document.getElementById("timerControls").style.display = "block";

    // Disable voting
    document.getElementById("candidatesSection").classList.add("voting-closed");
    disableVotingButtons();

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
        // Double-check if user has already voted (in case of race condition)
        const { data: existingVote, error: checkError } = await supabaseClient
            .from("votes")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

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
            
            // Handle duplicate key error specifically
            if (voteError.code === '23505') {
                hasVoted = true;
                disableVotingButtons();
                showStatus("⚠️ คุณได้ทำการโหวตไปแล้ว", "error");
                return;
            }
            
            throw voteError;
        }

        console.log("Vote recorded:", voteData);

        // Increment vote count in database
        const { data: rpcData, error: incrementError } = await supabaseClient
            .rpc("increment_vote", { cid: candidateId });

        if (incrementError) {
            console.error("Increment error:", incrementError);
            throw incrementError;
        }

        hasVoted = true;
        disableVotingButtons();
        showStatus("✓ โหวตสำเร็จ! ขอบคุณที่ร่วมลงคะแนน", "success");

        // Reload vote counts from database to ensure accuracy
        await loadCandidatesFromDB();

    } catch (error) {
        console.error("Error details:", error);
        showStatus("❌ เกิดข้อผิดพลาด: " + error.message, "error");
    }
}

function disableVotingButtons() {
    allCandidates.forEach(candidate => {
        const btn = document.getElementById(`btn${candidate.id}`);
        if (btn) btn.disabled = true;
    });
}

function enableVotingButtons() {
    allCandidates.forEach(candidate => {
        const btn = document.getElementById(`btn${candidate.id}`);
        if (btn) btn.disabled = false;
    });
}

// VERSION 1413: Render candidates dynamically
function renderCandidates() {
    const container = document.getElementById("candidatesSection");
    if (!container) return;
    
    container.innerHTML = "";
    
    allCandidates
        .sort((a, b) => a.display_order - b.display_order)
        .forEach(candidate => {
            const candidateDiv = document.createElement("div");
            candidateDiv.className = "candidate";
            candidateDiv.id = `candidate-${candidate.id}`;
            
            candidateDiv.innerHTML = `
                ${isAdmin() && !votingActive ? `
                    <button class="delete-candidate-btn" onclick="deleteCandidate('${candidate.id}')">
                        🗑️ ลบ
                    </button>
                ` : ''}
                
                <div class="candidate-info">
                    <img src="${candidate.image_url || 'https://via.placeholder.com/150'}" 
                         alt="${candidate.name}" 
                         class="candidate-img"
                         onerror="this.src='https://via.placeholder.com/150'">
                    <div class="candidate-details">
                        <h2 class="candidate-name" 
                            contenteditable="${isAdmin() && !votingActive ? 'true' : 'false'}" 
                            id="name${candidate.id}"
                            onblur="saveCandidateEdit('${candidate.id}')">${candidate.name}</h2>
                        <p class="candidate-desc" 
                           contenteditable="${isAdmin() && !votingActive ? 'true' : 'false'}"
                           id="desc${candidate.id}"
                           onblur="saveCandidateEdit('${candidate.id}')">${candidate.description || 'แก้ไขรายละเอียดได้'}</p>
                        ${isAdmin() && !votingActive ? `
                            <div style="margin-top: 10px;">
                                <input type="text" 
                                       id="img${candidate.id}" 
                                       value="${candidate.image_url || ''}"
                                       placeholder="URL รูปภาพ"
                                       onblur="saveCandidateEdit('${candidate.id}')"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="vote-section">
                    <button onclick="vote('${candidate.id}')" class="vote-btn" id="btn${candidate.id}">
                        <span>โหวต</span>
                    </button>
                    <div class="vote-count">
                        <span class="count-label">คะแนน:</span>
                        <span class="count-number" id="vote${candidate.id}">${candidate.votes || 0}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(candidateDiv);
        });
}

// VERSION 1413: Load candidates with full data
async function loadCandidatesFromDB() {
    try {
        const { data, error } = await supabaseClient
            .from("candidates")
            .select("*")
            .order("display_order");

        if (error) {
            console.error("Error loading candidates:", error);
            showStatus("⚠️ ไม่สามารถโหลดข้อมูลผู้สมัครได้", "error");
            return;
        }

        if (data && data.length > 0) {
            console.log("✅ Loaded candidates from DB:", data);
            allCandidates = data;
            
            // Update voteCounts object dynamically
            data.forEach(candidate => {
                voteCounts[candidate.id] = candidate.votes || 0;
            });
            
            // Re-render candidates
            renderCandidates();
            
            console.log("Current vote counts:", voteCounts);
        } else {
            console.log("No candidates found in database");
            allCandidates = [];
            renderCandidates();
        }
    } catch (error) {
        console.error("Error in loadCandidatesFromDB:", error);
        showStatus("❌ เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
    }
}

// VERSION 1412: Load voting session state from database
async function loadVotingSession() {
    try {
        const { data, error } = await supabaseClient
            .from("voting_session")
            .select("*")
            .eq("id", 1)
            .single();

        if (error) {
            console.error("Error loading session:", error);
            return;
        }

        if (data) {
            console.log("📊 Voting session loaded:", data);
            
            votingActive = data.is_active;
            
            if (data.is_active && data.end_time) {
                endTime = new Date(data.end_time).getTime();
                const now = Date.now();
                
                // Check if expired
                if (endTime <= now) {
                    console.log("⏰ Session expired");
                    await stopVotingSession();
                    return;
                }
                
                // Show timer
                document.getElementById("timerControls").style.display = "none";
                document.getElementById("timerDisplay").style.display = "block";
                document.getElementById("results").style.display = "none";
                document.getElementById("candidatesSection").classList.remove("voting-closed");
                
                // Start countdown
                updateCountdown();
                if (votingTimer) clearInterval(votingTimer);
                votingTimer = setInterval(updateCountdown, 1000);
                
                console.log("✅ Voting active - timer running");
            } else {
                console.log("❌ Voting not active");
                votingActive = false;
            }
        }
    } catch (error) {
        console.error("Error loading voting session:", error);
    }
}

// VERSION 1413: Update vote display for dynamic candidates
function updateVoteDisplay(candidateId) {
    const element = document.getElementById(`vote${candidateId}`);
    if (element && voteCounts[candidateId] !== undefined) {
        element.innerText = voteCounts[candidateId];
    }
}

// Setup Realtime Subscription - VERSION 1413
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
                console.log("🔔 Vote count updated via realtime:", payload);
                const candidateId = payload.new.id;
                if (voteCounts[candidateId] !== undefined) {
                    voteCounts[candidateId] = payload.new.votes;
                    updateVoteDisplay(candidateId);
                    
                    // Show notification
                    showStatus(`📊 คะแนนอัพเดท: ${payload.new.name} ได้รับ ${payload.new.votes} คะแนน`, "info");
                }
            }
        )
        .subscribe((status) => {
            console.log("Realtime subscription status:", status);
            if (status === "SUBSCRIBED") {
                console.log("✅ Realtime updates active");
            }
        });

    // Listen to votes table for immediate feedback
    supabaseClient
        .channel("votes_channel")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "votes"
            },
            (payload) => {
                console.log("🗳️ New vote detected:", payload);
                // Refresh vote counts after new vote
                loadCandidatesFromDB();
            }
        )
        .subscribe((status) => {
            console.log("Votes channel status:", status);
        });

    // VERSION 1412: Listen to voting_session changes
    supabaseClient
        .channel("session_channel")
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "voting_session"
            },
            (payload) => {
                console.log("🎯 Voting session updated:", payload);
                // Reload session immediately
                loadVotingSession();
            }
        )
        .subscribe((status) => {
            console.log("Session channel status:", status);
        });
    
    // VERSION 1413: Listen to candidates table for add/delete
    supabaseClient
        .channel("candidates_manage_channel")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "candidates"
            },
            (payload) => {
                console.log("👥 Candidates changed:", payload);
                // Reload all candidates
                loadCandidatesFromDB();
            }
        )
        .subscribe((status) => {
            console.log("Candidates management channel status:", status);
        });
}

// Show Results
async function showResults() {
    // Always load fresh data from database before showing results
    await loadCandidatesFromDB();
    
    const resultsSection = document.getElementById("results");
    const winnerDiv = document.getElementById("winner");
    const finalResultsDiv = document.getElementById("finalResults");

    resultsSection.style.display = "block";

    // Find winner
    const candidates = allCandidates.map(c => ({
        id: c.id,
        name: c.name,
        votes: voteCounts[c.id] || 0
    }));

    candidates.sort((a, b) => b.votes - a.votes);
    const winner = candidates[0];
    const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

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
                    <h3>${isWinner ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📊'} ${candidate.name}</h3>
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

// =========================================
// VERSION 1413: Candidate Management
// =========================================

// VERSION 1413: Save candidate edits
async function saveCandidateEdit(candidateId) {
    if (!isAdmin()) return;
    
    const nameEl = document.getElementById(`name${candidateId}`);
    const descEl = document.getElementById(`desc${candidateId}`);
    const imgEl = document.getElementById(`img${candidateId}`);
    
    if (!nameEl) return;
    
    const name = nameEl.innerText.trim();
    const description = descEl ? descEl.innerText.trim() : '';
    const image_url = imgEl ? imgEl.value.trim() : '';
    
    try {
        const { error } = await supabaseClient.rpc("update_candidate", {
            p_id: candidateId,
            p_name: name,
            p_description: description,
            p_image_url: image_url
        });
        
        if (error) throw error;
        
        console.log(`✅ Updated candidate ${candidateId}`);
        
        // Update local data
        const candidate = allCandidates.find(c => c.id === candidateId);
        if (candidate) {
            candidate.name = name;
            candidate.description = description;
            candidate.image_url = image_url;
        }
        
        // Re-render to update image
        renderCandidates();
        
    } catch (error) {
        console.error("Error updating candidate:", error);
        showStatus("❌ ไม่สามารถบันทึกการแก้ไขได้: " + error.message, "error");
    }
}

// VERSION 1413: Modal management
function setupCandidateModal() {
    const modal = document.getElementById("addCandidateModal");
    const showBtn = document.getElementById("showAddCandidate");
    const closeBtn = modal?.querySelector(".close");
    const cancelBtn = document.getElementById("cancelAddCandidate");
    const addBtn = document.getElementById("addCandidateBtn");
    
    if (showBtn) {
        showBtn.onclick = () => {
            if (!isAdmin()) {
                showStatus("⚠️ เฉพาะผู้ดูแลระบบเท่านั้น", "error");
                return;
            }
            modal.style.display = "block";
        };
    }
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = "none";
            clearModalFields();
        };
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.style.display = "none";
            clearModalFields();
        };
    }
    
    if (addBtn) {
        addBtn.onclick = addNewCandidate;
    }
    
    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
            clearModalFields();
        }
    };
}

function clearModalFields() {
    document.getElementById("newCandidateId").value = "";
    document.getElementById("newCandidateName").value = "";
    document.getElementById("newCandidateDesc").value = "";
    document.getElementById("newCandidateImage").value = "";
}

// VERSION 1413: Add new candidate
async function addNewCandidate() {
    if (!isAdmin()) {
        showStatus("⚠️ เฉพาะผู้ดูแลระบบเท่านั้น", "error");
        return;
    }
    
    const id = document.getElementById("newCandidateId").value.trim().toUpperCase();
    const name = document.getElementById("newCandidateName").value.trim();
    const description = document.getElementById("newCandidateDesc").value.trim() || "แก้ไขรายละเอียดได้";
    const image_url = document.getElementById("newCandidateImage").value.trim() || "https://via.placeholder.com/150";
    
    // Validation
    if (!id) {
        showStatus("⚠️ กรุณากรอกรหัสผู้สมัคร", "error");
        return;
    }
    
    if (!/^[A-Z0-9]+$/.test(id)) {
        showStatus("⚠️ รหัสผู้สมัครต้องเป็นตัวอักษร A-Z หรือตัวเลข 0-9 เท่านั้น", "error");
        return;
    }
    
    if (!name) {
        showStatus("⚠️ กรุณากรอกชื่อผู้สมัคร", "error");
        return;
    }
    
    // Check if ID already exists
    if (allCandidates.find(c => c.id === id)) {
        showStatus("⚠️ รหัสผู้สมัครนี้มีอยู่แล้ว", "error");
        return;
    }
    
    try {
        showStatus("🔄 กำลังเพิ่มผู้สมัคร...", "info");
        
        const { error } = await supabaseClient.rpc("add_candidate", {
            p_id: id,
            p_name: name,
            p_description: description,
            p_image_url: image_url
        });
        
        if (error) throw error;
        
        console.log(`✅ Added candidate ${id}`);
        showStatus("✅ เพิ่มผู้สมัครสำเร็จ!", "success");
        
        // Close modal
        document.getElementById("addCandidateModal").style.display = "none";
        clearModalFields();
        
        // Reload candidates
        await loadCandidatesFromDB();
        
    } catch (error) {
        console.error("Error adding candidate:", error);
        showStatus("❌ ไม่สามารถเพิ่มผู้สมัครได้: " + error.message, "error");
    }
}

// VERSION 1413: Delete candidate
async function deleteCandidate(candidateId) {
    if (!isAdmin()) {
        showStatus("⚠️ เฉพาะผู้ดูแลระบบเท่านั้น", "error");
        return;
    }
    
    const candidate = allCandidates.find(c => c.id === candidateId);
    if (!candidate) return;
    
    if (!confirm(`คุณต้องการลบ "${candidate.name}" ใช่หรือไม่?\n\n⚠️ การลบจะลบคะแนนโหวตของผู้สมัครนี้ด้วย`)) {
        return;
    }
    
    try {
        showStatus("🔄 กำลังลบผู้สมัคร...", "info");
        
        const { error } = await supabaseClient.rpc("delete_candidate", {
            p_id: candidateId
        });
        
        if (error) throw error;
        
        console.log(`✅ Deleted candidate ${candidateId}`);
        showStatus("✅ ลบผู้สมัครสำเร็จ!", "success");
        
        // Remove from local array
        delete voteCounts[candidateId];
        
        // Reload candidates
        await loadCandidatesFromDB();
        
    } catch (error) {
        console.error("Error deleting candidate:", error);
        showStatus("❌ ไม่สามารถลบผู้สมัครได้: " + error.message, "error");
    }
}

// Initialize app - VERSION 1413
async function init() {
    console.log("🚀 Initializing app... VERSION 1413");
    
    setupAuthListener();
    setupLoginButton();
    setupTimerControls();
    setupCandidateModal(); // VERSION 1413
    
    // Load candidates first
    await loadCandidatesFromDB();
    
    // VERSION 1412: Load voting session state
    await loadVotingSession();
    
    // Setup realtime updates
    setupRealtimeSubscription();
    
    // Check session every 5 seconds
    sessionCheckInterval = setInterval(loadVotingSession, 5000);
    
    console.log("✅ App initialized! VERSION 1413");
    console.log("Current candidates:", allCandidates);
    console.log("Voting active:", votingActive);
}

// Make functions globally accessible
window.vote = vote;
window.saveCandidateEdit = saveCandidateEdit;
window.deleteCandidate = deleteCandidate;

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
