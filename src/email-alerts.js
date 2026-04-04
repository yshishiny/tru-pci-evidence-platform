const nodemailer = require('nodemailer');
const { getDb } = require('./db');

/**
 * Email Alerts Module
 * Handles SMTP configuration and email sending
 */

/**
 * Get SMTP configuration from cloud_config table
 */
function getSMTPConfig() {
  try {
    const db = getDb();
    const config = db.prepare(
      "SELECT config_json FROM cloud_config WHERE provider = 'smtp' AND is_active = 1"
    ).get();

    if (!config) {
      return null;
    }

    return JSON.parse(config.config_json);
  } catch (err) {
    console.error('Failed to get SMTP config:', err);
    return null;
  }
}

/**
 * Create nodemailer transporter from SMTP config
 */
function createTransporter() {
  const smtpConfig = getSMTPConfig();

  if (!smtpConfig) {
    throw new Error('SMTP configuration not found or not active');
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port, 10),
    secure: smtpConfig.secure || false,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    }
  });

  return transporter;
}

/**
 * Generate professional email template
 */
function generateEmailTemplate(recipientName, evidenceItems, deadline = '7 days') {
  const itemsHTML = evidenceItems.map(item => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 0.75rem; color: #1e293b;">Requirement ${item.requirement_id}</td>
      <td style="padding: 0.75rem; color: #1e293b;">${item.folder_name}</td>
      <td style="padding: 0.75rem;"><span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; background: #fee2e2; color: #991b1b;">${item.status || 'empty'}</span></td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TRU PCI DSS Evidence Request</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 1.5rem;
    }
    .header p {
      margin: 0.5rem 0 0 0;
      opacity: 0.9;
    }
    .content {
      padding: 2rem;
    }
    .greeting {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: #1e293b;
    }
    .message-box {
      background: #f8fafc;
      border-left: 4px solid #3b82f6;
      padding: 1rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }
    .evidence-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.9rem;
    }
    .evidence-table th {
      background: #f1f5f9;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .cta-button {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin: 1.5rem 0;
      text-align: center;
    }
    .deadline-badge {
      display: inline-block;
      background: #fee2e2;
      color: #991b1b;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      margin: 1rem 0;
    }
    .footer {
      background: #f8fafc;
      padding: 1.5rem 2rem;
      text-align: center;
      font-size: 0.85rem;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TRU PCI DSS Evidence Platform</h1>
      <p>Evidence Submission Request</p>
    </div>

    <div class="content">
      <p class="greeting">Hi ${recipientName},</p>

      <div class="message-box">
        <strong>Action Required:</strong> Please review and submit the following evidence items to support our PCI DSS compliance assessment.
      </div>

      <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #1e293b;">Pending Evidence Items</h3>
      <table class="evidence-table">
        <thead>
          <tr>
            <th>Requirement</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div class="deadline-badge">
        ⏰ Deadline: ${deadline}
      </div>

      <p>Please submit your evidence through the TRU PCI DSS Evidence Platform:</p>
      <a href="${process.env.PLATFORM_URL || 'https://tru-pci.example.com'}" class="cta-button">Access Platform</a>

      <p style="margin-top: 1.5rem; color: #64748b; font-size: 0.9rem;">
        If you have any questions or need assistance, please reach out to your PCI DSS coordinator.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0;">TRU PCI DSS Evidence Platform | Auto-generated alert</p>
      <p style="margin: 0.5rem 0 0 0; color: #94a3b8;">${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Send email alert to a single recipient
 */
async function sendAlert(recipientEmail, recipientName, evidenceItems, options = {}) {
  try {
    const db = getDb();
    const transporter = createTransporter();

    const subject = options.subject || 'TRU PCI DSS: Evidence Submission Required';
    const deadline = options.deadline || '7 days';

    const html = generateEmailTemplate(recipientName, evidenceItems, deadline);

    // Send email
    const mailOptions = {
      from: options.from_email || getSMTPConfig().from_email,
      to: recipientEmail,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);

    // Record in alert history
    db.prepare(`
      INSERT INTO alert_history (recipient_email, recipient_name, subject, body, evidence_ids, status)
      VALUES (?, ?, ?, ?, ?, 'sent')
    `).run(
      recipientEmail,
      recipientName,
      subject,
      html,
      evidenceItems.map(e => e.id).join(',')
    );

    return {
      success: true,
      message_id: info.messageId,
      recipient: recipientEmail
    };
  } catch (err) {
    console.error('Failed to send alert:', err);

    // Record failed attempt
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO alert_history (recipient_email, recipient_name, subject, body, status)
        VALUES (?, ?, ?, ?, 'failed')
      `).run(recipientEmail, recipientName, options.subject || 'TRU PCI DSS: Evidence Submission Required', err.message);
    } catch (logErr) {
      console.error('Failed to log alert failure:', logErr);
    }

    throw new Error(`Failed to send alert: ${err.message}`);
  }
}

/**
 * Send alerts to all users with pending items
 */
async function sendBulkAlerts(options = {}) {
  try {
    const db = getDb();

    // Get users with pending items
    const usersWithPending = db.prepare(`
      SELECT DISTINCT u.id, u.username, u.display_name, u.email
      FROM users u
      WHERE u.assigned_requirements IS NOT NULL
      AND u.is_active = 1
    `).all();

    const results = [];

    for (const user of usersWithPending) {
      // Get their pending evidence items
      const assignedReqs = user.assigned_requirements
        ? user.assigned_requirements.split(',').map(id => parseInt(id, 10))
        : [];

      if (assignedReqs.length === 0) continue;

      const placeholders = assignedReqs.map(() => '?').join(',');
      const pendingItems = db.prepare(`
        SELECT id, requirement_id, folder_name, status
        FROM evidence_points
        WHERE requirement_id IN (${placeholders})
        AND status IN ('empty', 'uploaded', 'under_review', 'pm_revision', 'grc_revision')
        LIMIT 20
      `).all(...assignedReqs);

      if (pendingItems.length === 0) continue;

      try {
        const result = await sendAlert(
          user.email,
          user.display_name,
          pendingItems,
          {
            ...options,
            subject: `TRU PCI DSS: ${pendingItems.length} Evidence Items Pending Your Review`
          }
        );
        results.push({
          user: user.display_name,
          email: user.email,
          pending_count: pendingItems.length,
          status: 'sent'
        });
      } catch (err) {
        results.push({
          user: user.display_name,
          email: user.email,
          pending_count: pendingItems.length,
          status: 'failed',
          error: err.message
        });
      }
    }

    return results;
  } catch (err) {
    console.error('Bulk alert failed:', err);
    throw new Error(`Bulk alert failed: ${err.message}`);
  }
}

module.exports = {
  getSMTPConfig,
  createTransporter,
  generateEmailTemplate,
  sendAlert,
  sendBulkAlerts
};
