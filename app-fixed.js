// Email verification for timer controls

const allowedAdminEmails = ["admin1@example.com", "admin2@example.com"];

function isUserAllowed(email) {
    return allowedAdminEmails.includes(email);
}

// Timer functions
function accessTimerFunction(userEmail) {
    if (!isUserAllowed(userEmail)) {
        throw new Error("Access denied: user is not an admin.");
    }
    // Continue with timer operation
    console.log("Timer function accessed.");
}

// Example usage
// accessTimerFunction("user@example.com"); // This would throw an error, while an allowed email would work.
