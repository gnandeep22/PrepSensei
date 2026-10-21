# PrepSensei: Complete Local Setup & User Guide

> **Zero-Configuration Setup**: All cloud database connections (hosted Neon PostgreSQL) and API keys (Gemini AI, IndianAPI, Gmail SMTP OTP) are already pre-configured in `.env.local`. The recipient does **not** need to set up any database, install Docker, or register any new API keys. Simply install dependencies and launch!

---

## ⚡ 1. Quick Start (Run in Under 2 Minutes)

### Step 1: Extract the Zip File
Extract the received `prepsensei.zip` archive into any folder on your computer.

### Step 2: Open Terminal / Command Prompt
Open your terminal inside the extracted `prep-sensei` folder:
- **Windows**: Right-click inside the folder > select **Open in Terminal** or open Command Prompt (`cmd`) and `cd` into the folder.
- **macOS / Linux**: Open Terminal and `cd` to the folder.

### Step 3: Install Dependencies
Run one of the following commands:
```bash
npm install
```
*(Or if you use pnpm: `pnpm install`)*

### Step 4: Start the Local Development Server
```bash
npm run dev
```
*(Or if you use pnpm: `pnpm dev`)*

### Step 5: Open in Your Web Browser
Open your browser and visit:
👉 **[http://localhost:3000](http://localhost:3000)**

*(Google Chrome or Microsoft Edge is strongly recommended for full camera, microphone, WebGL, and Web Speech API support).*

---

## 💻 2. System Prerequisites

| Requirement | Recommended Version | Details |
| :--- | :--- | :--- |
| **Node.js** | `v18.18+` or `v20+ LTS` | Download from [nodejs.org](https://nodejs.org) |
| **Web Browser** | Google Chrome / Microsoft Edge | Best for WebRTC camera stream & Speech Recognition |
| **Hardware** | Laptop Webcam & Microphone | Used for real-time AI mock interviews & face tracking |
| **Internet** | Active Internet Connection | Needed for initial `npm install` and cloud DB connection |

---

## ☁️ 3. Pre-Configured Cloud Architecture

PrepSensei comes with all services pre-connected in `.env.local`:

1. **Neon Serverless PostgreSQL (Cloud Database)**:
   - Hosted remotely over SSL. All database tables (users, assessments, submissions, face registrations, proctoring events) are already migrated and live.
2. **Google Gemini AI SDK**:
   - Generates contextual interview questions, evaluates spoken candidate answers, and generates tailored feedback reports.
3. **IndianAPI Live Job Feed**:
   - Provides live job postings across software engineering, data science, DevOps, and business roles.
4. **Gmail SMTP Relay**:
   - Pre-configured for sending real-time 6-digit OTP verification codes directly to candidates during email registration.
5. **Client-Side Computer Vision Engine**:
   - Uses `face-api.js` with quantized MobileNet/ResNet neural network weights bundled in `public/models/`. Vision processing executes 100% locally in your browser using hardware-accelerated WebGL.

---

## 🎯 4. Full Feature Tour & How to Test Everything

### A. Candidate Registration & Sign-In (`/sign-in` & `/sign-up`)
1. Visit [http://localhost:3000/sign-in](http://localhost:3000/sign-in).
2. Click **Sign Up** to create an account:
   - Enter your name, email, and password.
   - A real 6-digit OTP will be emailed to your inbox via the pre-configured SMTP relay.
   - Enter the OTP to verify your account.
3. Or use existing credentials to sign in directly.

---

### B. Biometric Face Registration & Liveness Check
1. On the candidate onboarding flow, complete the 3-angle face capture (Front, Left profile, Right profile).
2. The system performs an anti-spoofing **liveness check** (verifying natural eye blinks and head orientation).
3. The biometric 128-dimensional facial embedding is cryptographically registered to your profile.

---

### C. AI Mock Interview Practice (`/interview`)
1. Click **Practice Interview** in the top navigation bar or go to [http://localhost:3000/interview](http://localhost:3000/interview).
2. Select your track: **Technical**, **Behavioral**, or **HR**.
3. Choose your target role (e.g. Frontend Engineer, Backend Developer, Fullstack, DevOps).
4. Click **Start Interview**:
   - Allow camera and microphone permissions when prompted by Chrome.
   - The **AI Interviewer** will introduce itself and ask questions out loud using native voice synthesis, complete with dynamic audio visualizer ripples.
   - Click **Mic Active** (or press the microphone button) and speak your answer out loud. The speech recognition engine will transcribe your speech in real time.
   - Click **Submit Answer** or advance to receive instantaneous feedback, rubric scores, and the next question.

---

### D. Real-Time Vision Proctoring Protocol
While practicing, observe the live telemetry dock below the video call and the candidate camera HUD badges:
- 🟢 **Identity Verified**: Confirms the person in frame matches registered candidate biometrics.
- 🔴 **Identity Mismatch Detected**: If a different person sits in front of the camera, the system flags an immediate alert in split-second ($\le 80$ms).
- 🟡 **No Face Detected**: If you step out of camera view, it immediately displays "No Face Detected" without false mismatch alarms.
- 🟠 **Multiple Persons Detected**: Alerts if a second person enters the camera frame.
- 🟠 **Camera Movement Detected**: Detects laptop movement, camera shaking, or sudden position shifts using room perimeter quadrant motion analysis.
- 👁 **Gaze Tracking**: Calibrated for 14" and 15.6" laptop screens. Looking at the questions on screen shows "Looking at Camera". Glancing away at your phone or desk triggers "Looking Away".
- 🎙 **Speech Visualizer**: Green soundwave bars animate when you are actively speaking.

---

### E. Recruiter Assessment Portal (`/recruiter`)
1. Visit [http://localhost:3000/recruiter](http://localhost:3000/recruiter).
2. Review candidate assessment submissions:
   - View composite scoring across Technical Proficiency, Communication, and Problem Solving.
   - Inspect the **Biometric Audit Snapshot**: Compare the candidate's registration reference photo side-by-side with live webcam snapshots captured during proctoring alerts.
   - View the detailed **Integrity Violations Log** with exact timestamps for look-aways, multiple faces, camera shifts, and biometric checks.
   - Set hiring decisions: **Hire**, **Fast-Track**, **Needs Second Review**, or **Reject**.

---

### F. Resume Analyzer & Live Job Recommendations
1. Visit the candidate dashboard.
2. Upload your resume (PDF or DOCX).
3. The system extracts skills, matches them with live job listings, and highlights missing prerequisites with recommended study tracks.

---

## 🔧 5. Troubleshooting & FAQs

### Q1: The camera tile says "Camera unavailable" or "Camera is turned off"
- **Solution**: In Chrome or Edge, click the **Tune / Lock** icon on the left side of the address bar (next to `http://localhost:3000`).
- Ensure **Camera** and **Microphone** permissions are set to **Allow**.
- Refresh the page (`Ctrl + R` or `Cmd + R`).

### Q2: Port 3000 is already in use by another application
- **Solution**: Run the app on an alternative port (e.g. port 3001):
  ```bash
  npx next dev -p 3001
  ```
- Then open `http://localhost:3001` in your browser.

### Q3: On Windows PowerShell: "cannot be loaded because running scripts is disabled on this system"
- **Solution**: Open Windows PowerShell as Administrator and run:
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- Or simply use standard Command Prompt (`cmd.exe`) and run `npm run dev`.

### Q4: The AI Interviewer is not speaking audio
- **Solution**: PrepSensei uses the browser's native Web Speech API Synthesis.
  - Verify your system speakers/headphones are unmuted and volume is up.
  - Click **Hear question** or the **Replay** button anytime to hear the question spoken again.

### Q5: Can I test on a different computer without internet?
- **Note**: An initial internet connection is required to download `node_modules` during `npm install` and to connect to the cloud Neon PostgreSQL database over SSL.

---

## 📦 6. Checklist Before Zipping & Sending

If you are packaging this folder to send:
1. ✅ **Ensure `.env.local` is included**: On Windows/macOS, dotfiles like `.env.local` can sometimes be hidden by default in File Explorer. Make sure `.env.local` is present in the zip root.
2. 💡 **Optional Size Optimization**: You can delete the `node_modules` folder and `.next` folder before zipping to reduce the zip size from $\sim 1.5\text{ GB}$ down to $\sim 35\text{ MB}$. Your friend will recreate them in seconds by running `npm install`.
3. ✅ **Ensure `public/models/` is included**: This folder contains the face-api neural network weights required for computer vision.
