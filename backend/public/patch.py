import re
import sys

# 1. Update index.html
with open('/Users/geirforbord/Papertek/leksihjelp/backend/public/index.html', 'r', encoding='utf-8') as f:
    index_content = f.read()

new_section = """    <div class="card" style="text-align: center; border: 1px solid rgba(59, 130, 246, 0.3); background: linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0.2) 100%);">
      <h2>Veien videre</h2>
      <p style="margin-bottom: 24px;">Vi jobber kontinuerlig med å forbedre Leksihjelp. Vil du vite mer om våre fremtidsplaner med ny ordbank og smarte anonyme stavekontroller?</p>
      <a href="/fremtidsplaner" class="github-link" style="display: inline-flex; justify-content: center; background: #3b82f6; border-color: #3b82f6; color: #fff; font-weight: 600;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Se våre fremtidsplaner
      </a>
    </div>

    <footer>"""

index_content = index_content.replace('    <footer>', new_section)

with open('/Users/geirforbord/Papertek/leksihjelp/backend/public/index.html', 'w', encoding='utf-8') as f:
    f.write(index_content)

# 2. Update fremtidsplaner.html
with open('/Users/geirforbord/Papertek/leksihjelp/backend/public/fremtidsplaner.html', 'r', encoding='utf-8') as f:
    fremtidsplaner_content = f.read()

new_style = """  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :root {
      --bg-color: #0c0c0e;
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success: #10b981;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: var(--bg-color);
      background-image: radial-gradient(circle at top, rgba(59, 130, 246, 0.08) 0%, transparent 50%);
      min-height: 100vh;
      color: var(--text-primary);
      line-height: 1.6;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Layout ── */
    .container {
      position: relative;
      z-index: 1;
      max-width: 820px;
      margin: 0 auto;
      padding: 60px 20px;
    }

    /* ── Header ── */
    header {
      text-align: center;
      margin-bottom: 60px;
      animation: fadeInDown 0.8s ease-out both;
    }

    .logo {
      font-size: 56px;
      margin-bottom: 20px;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
    }

    h1 {
      font-size: 3.5rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 16px;
      letter-spacing: -0.04em;
      line-height: 1.1;
    }

    .tagline {
      font-size: 1.25rem;
      color: var(--text-secondary);
      max-width: 500px;
      margin: 0 auto;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--text-primary);
      text-decoration: none;
      font-size: 0.95rem;
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      transition: all 0.2s;
      font-weight: 500;
      margin-top: 32px;
    }

    .back-link:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-1px);
    }

    /* ── Glassmorphism cards ── */
    .glass {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .glass:hover {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.12);
    }

    /* ── Scroll reveal animation ── */
    .reveal {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }

    .reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .stagger { opacity: 0; transform: translateY(12px); }
    .reveal.visible .stagger { animation: staggerIn 0.5s ease-out both; }
    .reveal.visible .stagger:nth-child(1) { animation-delay: 0.1s; }
    .reveal.visible .stagger:nth-child(2) { animation-delay: 0.18s; }
    .reveal.visible .stagger:nth-child(3) { animation-delay: 0.26s; }
    .reveal.visible .stagger:nth-child(4) { animation-delay: 0.34s; }
    .reveal.visible .stagger:nth-child(5) { animation-delay: 0.42s; }
    .reveal.visible .stagger:nth-child(6) { animation-delay: 0.50s; }

    @keyframes staggerIn {
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Typography ── */
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 24px;
      letter-spacing: -0.02em;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h3 {
      font-size: 1.1rem;
      margin-bottom: 12px;
      color: #fff;
      font-weight: 500;
    }

    p {
      color: var(--text-secondary);
      margin-bottom: 16px;
    }

    /* ── Phase labels ── */
    .phase-label {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 24px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-secondary);
    }

    /* ── Language grid ── */
    .lang-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 32px 0;
    }

    .lang-card {
      background: rgba(0, 0, 0, 0.2);
      padding: 24px 16px;
      border-radius: 12px;
      text-align: center;
      border: 1px solid var(--card-border);
      transition: all 0.2s;
    }

    .lang-card:hover {
      background: rgba(255, 255, 255, 0.05);
      transform: translateY(-2px);
    }

    .lang-card .flag {
      font-size: 2.2rem;
      margin-bottom: 12px;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.2));
    }

    .lang-card .name {
      font-weight: 500;
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .lang-card .code {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 4px;
      font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
    }

    /* ── List items ── */
    ul {
      list-style: none;
      padding: 0;
    }

    li {
      padding: 8px 0;
      position: relative;
      color: var(--text-secondary);
      font-size: 0.95rem;
    }

    .roadmap-item {
      padding-left: 28px;
    }

    .roadmap-item::before {
      content: "✓";
      position: absolute;
      left: 0;
      color: var(--success);
      font-weight: bold;
      font-size: 1.1rem;
    }

    /* ── Highlight / info boxes ── */
    .highlight-box, .privacy-box {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      margin: 32px 0;
      position: relative;
    }

    .highlight-box h3, .privacy-box h3 {
      color: #fff;
    }

    /* ── Diagram ── */
    .diagram {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      padding: 24px;
      margin: 32px 0;
      font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      line-height: 1.8;
      color: var(--text-secondary);
      overflow-x: auto;
      white-space: pre;
      border: 1px solid var(--card-border);
    }

    .diagram .keyword {
      color: var(--accent);
    }

    .diagram .value {
      color: var(--success);
    }

    .diagram .comment {
      color: rgba(255, 255, 255, 0.3);
    }

    /* ── Vision card accent ── */
    .vision-card {
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(59, 130, 246, 0.3);
      background: linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0.2) 100%);
    }

    /* ── Footer ── */
    footer {
      text-align: center;
      margin-top: 60px;
      padding: 32px 20px;
      border-top: 1px solid var(--card-border);
      color: var(--text-secondary);
      font-size: 0.9rem;
      animation: fadeInDown 0.8s ease-out 0.3s both;
    }

    footer a {
      color: var(--text-primary);
      text-decoration: none;
      transition: color 0.2s;
    }

    footer a:hover {
      color: var(--accent);
    }

    .footer-legal {
      margin-top: 16px;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.3);
      line-height: 1.6;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      h1 {
        font-size: 2.5rem;
      }
      .container {
        padding: 40px 16px;
      }
      .lang-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .lang-card {
        padding: 16px 12px;
      }
      .diagram {
        font-size: 0.75rem;
        padding: 16px;
      }
    }
    
    @media (max-width: 480px) {
      .lang-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>"""

fremtidsplaner_content = re.sub(r'<style>.*?</style>', new_style, fremtidsplaner_content, flags=re.DOTALL)

# Remove the old animated background elements
bg_elements_pattern = r'<!-- Animated background -->\s*<div class="bg-gradient"></div>\s*<div class="bg-orb bg-orb-1"></div>\s*<div class="bg-orb bg-orb-2"></div>\s*<div class="bg-orb bg-orb-3"></div>'
fremtidsplaner_content = re.sub(bg_elements_pattern, '', fremtidsplaner_content, flags=re.DOTALL)

# Make inline modifications in fremtidsplaner content
# There's a link at the bottom with purple styling: `style="color:#a78bfa;text-decoration:none;border-bottom:1px solid rgba(167,139,250,0.3);transition:border-color 0.2s;"`
fremtidsplaner_content = fremtidsplaner_content.replace(
    'style="color:#a78bfa;text-decoration:none;border-bottom:1px solid rgba(167,139,250,0.3);transition:border-color 0.2s;"',
    'style="color:#3b82f6;text-decoration:none;border-bottom:1px solid rgba(59,130,246,0.3);transition:border-color 0.2s;"'
).replace('<p style="margin-bottom:0;">', '<p style="margin-bottom:0;color:var(--text-secondary);">')

with open('/Users/geirforbord/Papertek/leksihjelp/backend/public/fremtidsplaner.html', 'w', encoding='utf-8') as f:
    f.write(fremtidsplaner_content)

print("Done patching.")
