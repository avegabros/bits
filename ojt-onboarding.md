# Welcome to Avegabros OJT 2026

## The Mission:
To master professional web development using a real-world server environment.

---

## The Infrastructure (Raspberry Pi 5)
- **Hardware**: Raspberry Pi 5 (8GB) with Active Cooling.
- **Power**: Official 27W USB-C (High Stability).
- **Network**:
  - Office: `pi5.local` (Local LAN)
  - Remote: Tailscale Mesh VPN (Permanent IP)
- **Care Rule**: Do not place objects on the Pi; it needs airflow to keep your code running!

---

## The "Avegabros" Tech Stack
- **FRONTEND**: NEXT.JS & TAILWIND CSS
- **BACKEND**: EXPRESS.JS & NODE.JS
- **DATABASE**: POSTGRESQL (RELATIONAL) & REDIS (CACHING)
- **ORM**: PRISMA (DATABASE BRIDGE)
- **INFRASTRUCTURE**: DOCKER & DOCKER COMPOSE (CONTAINERIZATION)
- **MONITORING**: COCKPIT & PORTAINER

---

## Credentials & Access
**Action Required: Change your passwords immediately!**

- **Username**: `[FirstInitial][Surname]` (e.g., mcaya, rarnado)
- **SSH & Cockpit Initial Password**: `ojt@2026`
  *(Note: Linux will force a change on your first SSH login.)*
- **Portainer UI Initial Password**: `intern@2026`
  *(Note: Change this manually in your Portainer Profile settings.)*

---

## The Port Table

| Intern | Next.js | Express | Prisma | | Intern | Next.js | Express | Prisma |
|---|---|---|---|---|---|---|---|---|
| mcaya | 3001 | 4001 | 5001 | | jolasiman | 3008 | 4008 | 5008 |
| aarsolon | 3002 | 4002 | 5002 | | scases | 3009 | 4009 | 5009 |
| asabang | 3003 | 4003 | 5003 | | kvalenzuela | 3010 | 4010 | 5010 |
| manoos | 3004 | 4004 | 5004 | | gmendaro | 3011 | 4011 | 5011 |
| dbibat | 3005 | 4005 | 5005 | | jtaoy | 3012 | 4012 | 5012 |
| krosacena | 3006 | 4006 | 5006 | | ncabahug | 3013 | 4013 | 5013 |
| hcanales | 3007 | 4007 | 5007 | | rarnado | 3014 | 4014 | 5014 |

---

## Development Workflow
**How we write code at Avegabros**
- **Environment**: Connect via VS Code Remote - SSH to `username@pi5.local`.
- **Versioning**: All code is hosted on GitHub under the avegabros Org.
- **Local Dev**: Run your apps inside Docker containers.
- **Mirroring**: Group projects are mirrored to our internal Gitea server automatically.

---

## VS Code Setup (Your IDE)
*"Don't code in the terminal. Use a professional IDE."*
- Install VS Code on your own laptop.
- Install Extension: Look for "Remote - SSH" by Microsoft in the Extensions Marketplace.
- Connect:
  - Press F1 or Ctrl+Shift+P.
  - Type `Remote-SSH: Connect to Host...`
  - Enter: `username@pi5.local` (e.g., `mcaya@pi5.local`).
- Work: Once connected, you can open your home folder on the Pi. It works exactly like a local folder!

---

## Management Dashboards
Save these URLs in your bookmarks:
- **System Dashboard (Cockpit)**: `https://pi5.local:9090`
  - Monitor CPU/RAM usage of the server.
- **Docker Manager (Portainer)**: `https://pi5.local:9443`
  - Manage your containers and view logs.
- **Database Viewer (Prisma Studio)**: `http://pi5.local:[Your_50xx_Port]`
  - View and edit your database tables in the browser.

---

## Task Tracking (The Kanban Board)
*"If it isn't on the board, it doesn't exist."*
- **Platform**: We use GitHub Projects within the Avegabros Organization.
- **The Workflow**:
  - **To Do**: Tasks assigned by the Mentor. Pick a task and move it to "In Progress."
  - **In Progress**: You are actively writing code for this task.
  - **Review**: Once you push your code, open a Pull Request (PR).
- **The Magic Command**: In your PR description, type `closes #12` (replace 12 with your task's Issue number).
- **Automation**: This command automatically moves your card to Review and notifies the Mentor.

---

## Digital Progress Log (GitHub Issues)
**Standardizing your Daily Reports**
- **The Template**: Every morning, go to the avegabros repo and create a new Issue.
- **Select**: "Daily Stand-up Log."
- **Mandatory Sections**:
  - **Accomplishments**: What did you finish yesterday? (Link your PRs).
  - **Today's Goals**: What is your #1 priority?
  - **Blockers**: What is stopping you? (Hardware, Logic, Access?).
- **Deadline**: This must be submitted before 1:00 PM every day.

---

## Daily Stand-ups & Progress Logs
- **The Meeting**: 1:00 PM Sharp after launch.
- **The Format**: 15 minutes. 3 questions:
  1. What did I finish yesterday?
  2. What am I doing today?
  3. What are my Blockers?
- **The Digital Log**: Before 1:00 PM, create a GitHub Issue using the "Daily Stand-up" template in the repo.

---

## Performance Evaluation (Grading)
**How your success will be measured:**
- **System Discipline (25%)**: Stick to your ports! Do not crash the Pi by leaving zombie processes or violating the sudo policy.
- **Technical Growth (25%)**: Mastering the stack (Next.js, Express, Prisma). How well can you translate a requirement into working code?
- **Git & Workflow (20%)**: Meaningful commits and PRs. Moving your cards on the Kanban board and linking them to Issues.
- **Communication (20%)**: Submitting your Stand-up Log before 1 PM and reporting blockers clearly.
- **Code Quality (10%)**: Clean code that follows our naming conventions and passes linting.

---

## Working From Home (Tailscale)
- **Security**: We will not use public IPs. We use Tailscale.
- **Setup**:
  - Install Tailscale on your personal laptop.
  - Click the Invite Link found in your Terminal Dashboard (MOTD).
  - Use the Tailscale IP to connect via SSH from home.

---

## House Rules & Best Practices
- **Resource Awareness**: We share 8GB RAM. Stop your containers (`docker compose down`) when not in use.
- **Git Discipline**: Commit/Push at least twice a day.
- **Security**: Never share passwords; protect your SSH key.
- **Ownership**: You are responsible for your assigned port range.

---

## Day 1 Mission Checklist
- [ ] Send GitHub username and Email to Viber.
- [ ] SSH into the Pi and change your password.
- [ ] Join the avegabros GitHub Org.
- [ ] Fork the ojt-starter-template.
- [ ] Update your docker-compose.yml with your unique ports.
- [ ] Create your first "Daily Stand-up" Issue on GitHub.
