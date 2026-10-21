const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function generatePdfGuide() {
  const outputPath = path.join(__dirname, "..", "PrepSensei_Setup_and_User_Guide.pdf");
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    bufferPages: true,
    autoFirstPage: true,
  });

  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Corporate & Modern Palette
  const primaryNavy = "#0f172a"; // Deep Slate / Navy
  const brandBlue = "#2563eb";   // Royal Blue
  const indigoDark = "#312e81";  // Deep Indigo
  const textDark = "#1e293b";    // Slate 800 body text
  const mutedText = "#64748b";   // Slate 500 secondary text
  const codeBg = "#090d16";      // Terminal Dark
  const codeGreen = "#10b981";   // Emerald command text
  const successBorder = "#10b981";
  const successBg = "#ecfdf5";
  const warnBorder = "#f59e0b";
  const warnBg = "#fffbeb";
  const infoBorder = "#3b82f6";
  const infoBg = "#eff6ff";

  const contentWidth = doc.page.width - 100; // 495.28 pt

  function drawTopHeader(title, subtitle) {
    doc.rect(0, 0, doc.page.width, 92).fill(primaryNavy);
    doc.rect(0, 88, doc.page.width, 4).fill(brandBlue);

    doc.fillColor("#ffffff")
       .font("Helvetica-Bold")
       .fontSize(20)
       .text(title, 50, 26);

    doc.fillColor("#94a3b8")
       .font("Helvetica")
       .fontSize(9.5)
       .text(subtitle, 50, 54);

    doc.y = 110;
  }

  function sectionHeading(num, title) {
    if (doc.y > doc.page.height - 110) {
      doc.addPage();
      doc.y = 50;
    } else {
      doc.moveDown(0.7);
    }

    const currentY = doc.y;
    // Left decorative colored pill
    doc.roundedRect(50, currentY, 24, 18, 3).fill(brandBlue);
    doc.fillColor("#ffffff")
       .font("Helvetica-Bold")
       .fontSize(10)
       .text(num, 50, currentY + 4, { width: 24, align: "center" });

    doc.fillColor(primaryNavy)
       .font("Helvetica-Bold")
       .fontSize(13)
       .text(title, 82, currentY + 3);

    doc.moveDown(0.5);
  }

  function subHeading(title) {
    if (doc.y > doc.page.height - 80) {
      doc.addPage();
      doc.y = 50;
    } else {
      doc.moveDown(0.4);
    }

    doc.fillColor(indigoDark)
       .font("Helvetica-Bold")
       .fontSize(10.5)
       .text(title, 50);

    doc.moveDown(0.2);
  }

  function paragraph(text) {
    doc.fillColor(textDark)
       .font("Helvetica")
       .fontSize(9)
       .lineGap(2)
       .text(text, 50, doc.y, { width: contentWidth, align: "left" });
    doc.moveDown(0.3);
  }

  function codeBox(lines) {
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
      doc.y = 50;
    }

    const boxHeight = lines.length * 15 + 14;
    const startY = doc.y;

    doc.roundedRect(50, startY, contentWidth, boxHeight, 5)
       .fillAndStroke(codeBg, "#1e293b");

    let textY = startY + 7;
    doc.font("Courier-Bold").fontSize(9);

    lines.forEach((line) => {
      if (line.startsWith("#")) {
        doc.fillColor("#64748b").text(line, 62, textY);
      } else {
        doc.fillColor(codeGreen).text(line, 62, textY);
      }
      textY += 15;
    });

    doc.y = startY + boxHeight + 6;
  }

  function alertBox(title, bodyText, type = "info") {
    if (doc.y > doc.page.height - 90) {
      doc.addPage();
      doc.y = 50;
    }

    let border = infoBorder;
    let bg = infoBg;
    let headerColor = brandBlue;

    if (type === "success") {
      border = successBorder;
      bg = successBg;
      headerColor = "#065f46";
    } else if (type === "warn") {
      border = warnBorder;
      bg = warnBg;
      headerColor = "#92400e";
    }

    const startY = doc.y;
    const textHeight = doc.heightOfString(bodyText, { width: contentWidth - 24, font: "Helvetica", size: 8.5 }) + 26;

    doc.roundedRect(50, startY, contentWidth, textHeight, 5)
       .fillAndStroke(bg, border);

    doc.fillColor(headerColor)
       .font("Helvetica-Bold")
       .fontSize(9)
       .text(title, 62, startY + 7);

    doc.fillColor(textDark)
       .font("Helvetica")
       .fontSize(8.5)
       .lineGap(2)
       .text(bodyText, 62, startY + 20, { width: contentWidth - 24 });

    doc.y = startY + textHeight + 8;
  }

  function bulletItem(title, text) {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      doc.y = 50;
    }

    const currentY = doc.y;
    doc.fillColor(brandBlue).font("Helvetica-Bold").fontSize(10).text(">", 52, currentY);

    doc.fillColor(primaryNavy)
       .font("Helvetica-Bold")
       .fontSize(9)
       .text(title + ": ", 65, currentY, { continued: true });

    doc.fillColor(textDark)
       .font("Helvetica")
       .fontSize(9)
       .text(text, { width: contentWidth - 15, lineGap: 1.5 });

    doc.moveDown(0.25);
  }

  // ==========================================
  // PAGE 1: TITLE & EXECUTIVE QUICK START
  // ==========================================
  drawTopHeader(
    "PrepSensei: Complete Setup & User Guide",
    "Self-Contained Local Setup Guide & Full Feature Reference • Zero Configuration"
  );

  alertBox(
    "ZERO CONFIGURATION REQUIRED FOR RECIPIENT",
    "This folder contains the complete, ready-to-run PrepSensei project. The hosted cloud database (Neon Serverless PostgreSQL) and all API keys (Gemini AI, IndianAPI, Gmail SMTP OTP) are ALREADY pre-configured inside .env.local. The recipient does NOT need to create a database or obtain any API keys. Simply install dependencies and launch!",
    "success"
  );

  sectionHeading("1", "Quick Start Guide (Run in 2 Minutes)");
  paragraph("Follow these exact steps to launch PrepSensei on any Windows, macOS, or Linux computer:");

  bulletItem("Step 1 (Extract)", "Extract the received prepsensei.zip archive into any folder on your computer.");
  bulletItem("Step 2 (Open Terminal)", "Open Command Prompt (cmd), PowerShell, or Terminal inside the extracted prep-sensei folder.");
  bulletItem("Step 3 (Install Packages)", "Install project dependencies by executing:");
  codeBox(["npm install", "# OR if using pnpm:", "pnpm install"]);

  bulletItem("Step 4 (Start Server)", "Start the local Next.js development server:");
  codeBox(["npm run dev", "# OR if using pnpm:", "pnpm dev"]);

  bulletItem("Step 5 (Open in Browser)", "Open your browser and navigate to:");
  codeBox(["http://localhost:3000"]);

  alertBox(
    "CRITICAL: Ensure .env.local is Included in the Folder",
    "When sending or extracting the zip, make sure the hidden file '.env.local' remains in the project root alongside package.json. This file connects the project to the live cloud PostgreSQL database and activates all AI interview features automatically.",
    "warn"
  );

  sectionHeading("2", "System Prerequisites");
  bulletItem("Node.js", "Version 18.18+ or 20+ LTS recommended. Download from https://nodejs.org.");
  bulletItem("Web Browser", "Google Chrome or Microsoft Edge recommended (optimal for WebRTC camera stream, WebGL face detection, and Web Speech API).");
  bulletItem("Hardware", "Standard laptop webcam and microphone (or external USB webcam).");
  bulletItem("Internet", "Active internet connection for package installation and communicating with the hosted Neon cloud database.");

  // ==========================================
  // PAGE 2: ARCHITECTURE & ZERO-CONFIG STACK
  // ==========================================
  doc.addPage();
  doc.y = 50;

  sectionHeading("3", "Pre-Configured Cloud Architecture");
  paragraph("PrepSensei is built on a scalable cloud architecture requiring zero local server setup:");

  bulletItem("Neon Serverless PostgreSQL", "The relational database is hosted on AWS via Neon Serverless PostgreSQL with SSL. Tables, schemas, and relational indexes are already migrated and live.");
  bulletItem("Google Gemini AI SDK", "Powers dynamic interview questions, real-time context-aware follow-ups, and automated candidate speech scoring.");
  bulletItem("IndianAPI Job Feed", "Fetches live, real-world tech, finance, and engineering job listings across India and global markets.");
  bulletItem("Gmail SMTP Relay", "Pre-configured for sending real-time 6-digit OTP verification codes directly to candidates during email registration.");
  bulletItem("Client-Side Vision AI", "Uses face-api.js with quantized MobileNet/ResNet models bundled inside public/models/. Vision processing executes 100% locally in your browser with hardware-accelerated WebGL.");

  sectionHeading("4", "Feature Walkthrough & How to Test Everything");

  subHeading("Module A: Candidate Sign-In & OTP Registration (/sign-in)");
  bulletItem("Sign In / Sign Up", "Visit http://localhost:3000/sign-in. Candidates can log in or click 'Sign Up' to register.");
  bulletItem("Real Email OTP", "Enter your Name, Email, and Password. A real 6-digit OTP verification code will be sent to your email inbox via SMTP. Enter the OTP to verify.");
  bulletItem("Quick Demo Access", "Pre-seeded test credentials are also available on the login page for rapid 1-click evaluation.");

  subHeading("Module B: Biometric Face Registration (Continuous Identity)");
  bulletItem("3-Angle Face Capture", "Candidate captures Front, Left profile, and Right profile facial angles.");
  bulletItem("Anti-Spoofing Liveness", "Analyzes natural eye blinks and micro-movements to confirm a live human is present.");
  bulletItem("Biometric Reference Vector", "Stores a cryptographic 128-dimensional facial embedding in PostgreSQL for continuous identity authentication during interviews.");

  subHeading("Module C: AI Mock Interview Practice (/interview)");
  bulletItem("Track Selection", "Navigate to '/interview'. Select Technical, Behavioral, or HR interview formats.");
  bulletItem("Role Customization", "Select target job role (e.g. Frontend Engineer, Fullstack Developer, Backend, DevOps, Data Science).");
  bulletItem("AI Speaking Engine", "The AI interviewer asks questions out loud using voice synthesis, with dynamic radar ripple soundwave visualizers.");
  bulletItem("Speech Recognition", "Click 'Mic Active' and speak naturally. Real-time Speech-to-Text transcribes your spoken answers live.");

  // ==========================================
  // PAGE 3: PROCTORING PROTOCOL & RECRUITER
  // ==========================================
  doc.addPage();
  doc.y = 50;

  sectionHeading("5", "Real-Time AI Vision Proctoring Protocol");
  paragraph("PrepSensei features a calibrated, continuous vision engine that monitors candidate integrity throughout the interview session. Observe the live HUD badges on the camera preview and the telemetry dock below:");

  bulletItem("Biometric Continuous Auth", "Continuously audits WHO is sitting in front of the camera every split second. If an unauthorized person takes the seat, an instant 'Identity Mismatch Detected' alert triggers in 80ms.");
  bulletItem("Strict No-Face Detection", "When the candidate leaves the frame, the system transitions immediately to 'No Face Detected' (yellow warning pill) without false mismatch alarms.");
  bulletItem("Screen Gaze Tracking", "Calibrated for 14\" and 15.6\" laptop displays. Reading questions on screen keeps status at 'Looking at Camera'. Looking away at a phone or desk triggers 'Looking Away'.");
  bulletItem("Multiple Faces Detection", "Detects when 2 or more people enter the camera view, flagging 'Multiple Persons Detected'.");
  bulletItem("Camera Movement Detection", "Uses peripheral background room quadrant motion analysis to detect camera shaking, tampering, or laptop angle shifts.");
  bulletItem("Simultaneous Multi-Error Deck", "If an identity mismatch, extra person, and camera shake occur simultaneously, all active warnings display concurrently without hiding each other.");

  sectionHeading("6", "Recruiter Assessment Portal (/recruiter)");
  paragraph("Access the recruiter management portal at http://localhost:3000/recruiter:");

  bulletItem("Live Submissions Feed", "Review all candidate submissions with composite scores, category rubrics, and AI hiring recommendations.");
  bulletItem("Biometric Audit Snapshot", "Compare the candidate's registration reference photo side-by-side with live webcam snapshots captured during proctoring alerts.");
  bulletItem("Integrity Violations Log", "View exact timestamps and durations for all proctoring incidents (look-aways, multiple faces, camera shifts, identity checks).");
  bulletItem("Hiring Decision System", "Record official hiring decisions: 'Hire', 'Fast-Track', 'Needs Second Review', or 'Reject' with feedback notes.");

  sectionHeading("7", "Resume Analyzer & Live Job Recommendations");
  bulletItem("Resume Parser", "Upload any PDF or DOCX resume on the dashboard. The system extracts technical skills, experience, and education.");
  bulletItem("Skill-Match Scoring", "Calculates match scores against live tech openings, highlighting matching skills and missing prerequisites.");

  // ==========================================
  // PAGE 4: TROUBLESHOOTING & SENDER CHECKLIST
  // ==========================================
  doc.addPage();
  doc.y = 50;

  sectionHeading("8", "Troubleshooting & Frequently Asked Questions");

  subHeading("Q1: The camera tile says 'Camera is turned off' or 'Camera unavailable'");
  paragraph("Fix: In Chrome or Edge, click the 'Tune / Lock' icon on the left side of the address bar (next to http://localhost:3000). Ensure 'Camera' and 'Microphone' permissions are set to 'Allow'. Then refresh the page.");

  subHeading("Q2: Port 3000 is already in use by another application");
  paragraph("Fix: Launch the server on another port by running: npx next dev -p 3001, then open http://localhost:3001 in your browser.");

  subHeading("Q3: On Windows PowerShell: 'running scripts is disabled on this system'");
  paragraph("Fix: Open PowerShell as Administrator and run: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser, OR simply run: npx next dev in Command Prompt (cmd).");

  subHeading("Q4: The AI Interviewer is not speaking audio");
  paragraph("Fix: PrepSensei uses the browser's native Web Speech API Synthesis. Ensure your computer's sound / speakers are unmuted. Click 'Hear question' or 'Replay' anytime to hear the question spoken again.");

  sectionHeading("9", "Checklist for Packaging the Zip File");
  paragraph("Before sending the zip file to your friend, please confirm the following:");

  bulletItem("Include .env.local", "Verify that the hidden file .env.local is included in the zip root. (On Windows, enable 'View > Hidden items' to confirm).");
  bulletItem("Optional Size Optimization", "To reduce zip size from ~1.5 GB down to ~35 MB, you can delete 'node_modules' and '.next' folders before zipping. Your friend will regenerate them cleanly by running 'npm install'.");
  bulletItem("Include public/models", "Ensure the 'public/models' folder is intact. It contains the quantized face-api neural network weights required for local vision processing.");

  alertBox(
    "ASSISTANCE & SUPPORT",
    "PrepSensei is fully self-contained and pre-configured. For the best experience, run Google Chrome or Microsoft Edge, allow camera/mic access, and maximize your browser window. Happy interview practicing!",
    "info"
  );

  // Footer on all pages (written without triggering extra pages)
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    // Disable bottom margin so footer text does not trigger auto-page-break
    const origBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    // Draw subtle footer divider line
    doc.rect(50, doc.page.height - 38, contentWidth, 0.5).fill("#cbd5e1");
    doc.fillColor(mutedText)
       .font("Helvetica")
       .fontSize(8)
       .text(
         `PrepSensei Setup & User Guide • Page ${i + 1} of ${totalPages}`,
         50,
         doc.page.height - 28,
         { align: "center", width: contentWidth, lineBreak: false }
       );

    doc.page.margins.bottom = origBottomMargin;
  }

  doc.end();

  writeStream.on("finish", () => {
    console.log("PDF generation completed successfully: " + outputPath);
  });
}

generatePdfGuide();
