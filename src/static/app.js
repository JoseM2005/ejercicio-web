document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper: create participant list item node
  function createParticipantLi(email, activityName) {
    const li = document.createElement('li');

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = email.charAt(0).toUpperCase();

    const emailSpan = document.createElement('span');
    emailSpan.className = 'email';
    emailSpan.textContent = email;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.dataset.activity = activityName;
    removeBtn.dataset.email = email;
    removeBtn.textContent = '×';

    li.appendChild(avatar);
    li.appendChild(emailSpan);
    li.appendChild(removeBtn);
    li.classList.add('new-participant');

    // Remove highlight after a short delay
    setTimeout(() => li.classList.remove('new-participant'), 2000);

    return li;
  }

  // Helper: update specific activity card in-place to show new participant and availability
  function updateActivityCardAfterSignup(activityName, email) {
    const cards = activitiesList.querySelectorAll('.activity-card');
    for (const card of cards) {
      const h4 = card.querySelector('h4');
      if (h4 && h4.textContent === activityName) {
        // Avoid duplicates: if participant already present, do nothing
        if (card.querySelector(`button.remove-btn[data-email="${email}"]`)) {
          return;
        }

        // Update availability text
        const availabilityP = Array.from(card.querySelectorAll('p')).find(p => p.querySelector('strong') && p.querySelector('strong').textContent.includes('Availability'));
        if (availabilityP) {
          const match = availabilityP.textContent.match(/(\d+) spots left/);
          if (match) {
            let spots = parseInt(match[1], 10) - 1;
            if (spots < 0) spots = 0;
            availabilityP.innerHTML = `<strong>Availability:</strong> ${spots} spots left`;
          }
        }

        // Add participant to the participants list
        const details = card.querySelector('details.participants');
        if (details) {
          // If previously 'No participants yet.' replace it with a UL
          let ul = details.querySelector('ul');
          if (!ul) {
            const noDiv = details.querySelector('.no-participants');
            if (noDiv) noDiv.remove();
            ul = document.createElement('ul');
            details.appendChild(ul);
          }
          const newLi = createParticipantLi(email, activityName);
          ul.appendChild(newLi);
          details.open = true;
        }
        return;
      }
    }
    // If card not found, fallback to full refresh
    fetchActivities();
  }

  // Helper: update specific activity card in-place to remove a participant and update availability
  function updateActivityCardAfterRemove(activityName, email) {
    const cards = activitiesList.querySelectorAll('.activity-card');
    for (const card of cards) {
      const h4 = card.querySelector('h4');
      if (h4 && h4.textContent === activityName) {
        const details = card.querySelector('details.participants');
        if (details) {
          const btn = details.querySelector(`button.remove-btn[data-email="${email}"]`);
          if (btn) {
            const li = btn.closest('li');
            if (li) li.remove();
          }

          const ul = details.querySelector('ul');
          if (!ul || (ul && ul.children.length === 0)) {
            if (ul) ul.remove();
            const noDiv = document.createElement('div');
            noDiv.className = 'no-participants';
            noDiv.textContent = 'No participants yet.';
            details.appendChild(noDiv);
          }
        }

        // Update availability text (increment)
        const availabilityP = Array.from(card.querySelectorAll('p')).find(p => p.querySelector('strong') && p.querySelector('strong').textContent.includes('Availability'));
        if (availabilityP) {
          const match = availabilityP.textContent.match(/(\d+) spots left/);
          if (match) {
            let spots = parseInt(match[1], 10) + 1;
            availabilityP.innerHTML = `<strong>Availability:</strong> ${spots} spots left`;
          }
        }
        return;
      }
    }
    // If card not found, fallback to full refresh
    fetchActivities();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message and select options
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants list HTML (styled chips with avatars and remove button)
        const participantsHtml = details.participants && details.participants.length > 0
          ? `<details class="participants"><summary>Participants (${details.participants.length})</summary><ul>${details.participants.map(p => `<li><span class="avatar">${p.charAt(0).toUpperCase()}</span><span class="email">${p}</span><button class="remove-btn" data-activity="${name}" data-email="${p}">×</button></li>`).join('')}</ul></details>`
          : `<details class="participants"><summary>Participants (0)</summary><div class="no-participants">No participants yet.</div></details>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${participantsHtml}
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Event delegation: handle remove participant clicks
  activitiesList.addEventListener("click", async (e) => {
    const btn = e.target.closest('.remove-btn');
    if (!btn) return;

    const email = btn.dataset.email;
    const activityName = btn.dataset.activity;

    if (!confirm(`Remove ${email} from ${activityName}?`)) return;

    try {
      const resp = await fetch(
        `/activities/${encodeURIComponent(activityName)}/participants?email=${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      const result = await resp.json();

      if (resp.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = 'success';
        // Refresh activities so participants and availability update
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || 'Error removing participant';
        messageDiv.className = 'error';
      }

      messageDiv.classList.remove('hidden');
      setTimeout(() => messageDiv.classList.add('hidden'), 5000);
    } catch (err) {
      messageDiv.textContent = 'Failed to remove participant. Please try again.';
      messageDiv.className = 'error';
      messageDiv.classList.remove('hidden');
      console.error('Error removing participant:', err);
    }
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Update the activity card in-place so the new participant appears immediately
        updateActivityCardAfterSignup(activity, email);
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();

  // Setup Server-Sent Events to receive roster updates in real-time
  try {
    const es = new EventSource('/events');

    es.addEventListener('signup', (e) => {
      try {
        const payload = JSON.parse(e.data);
        // Update UI for signup events
        updateActivityCardAfterSignup(payload.activity, payload.email);
      } catch (err) {
        console.error('Error parsing signup event', err);
      }
    });

    es.addEventListener('remove', (e) => {
      try {
        const payload = JSON.parse(e.data);
        updateActivityCardAfterRemove(payload.activity, payload.email);
      } catch (err) {
        console.error('Error parsing remove event', err);
      }
    });

    es.addEventListener('init', (e) => {
      // Ensure we have the latest state on connect
      try {
        // Refresh whole UI with server state
        fetchActivities();
      } catch (err) {
        console.error('Error handling init event', err);
      }
    });

    es.onerror = (err) => {
      console.warn('EventSource error', err);
    };
  } catch (err) {
    console.warn('SSE not supported or failed to connect', err);
  }
});
