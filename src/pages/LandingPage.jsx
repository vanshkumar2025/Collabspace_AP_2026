import React from 'react';
import ThemeToggle from '../components/ThemeToggle';
import SimpleBackground from '../components/SimpleBackground';
import logoImg from '../images/Logo.png';

export default function LandingPage() {
  // Handle smooth scroll for anchor links
  const handleAnchorClick = (e, targetId) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="landing-page">
      {/* Clean, lightweight ambient background */}
      <div className="landing-atmosphere" aria-hidden="true">
        <SimpleBackground />
      </div>

      {/* Site Header */}
      <header className="site-header">
        <div className="shell header-shell">
          <a className="brand" href="/">
            <img
              src={logoImg}
              alt="CollabSpace Logo"
              className="brand-logo"
              style={{
                height: '32px',
                width: 'auto',
                transform: 'scale(2.5)',
                transformOrigin: 'left center',
                marginRight: '25px',
              }}
            />
            <span className="brand-copy" style={{ zIndex: 1, position: 'relative' }}>
              <strong>CollabSpace</strong>
            </span>
          </a>

          <nav className="site-nav" aria-label="Main navigation">
            <a href="#problem" onClick={(e) => handleAnchorClick(e, 'problem')}>
              Problem
            </a>
            <a href="#solution" onClick={(e) => handleAnchorClick(e, 'solution')}>
              Features
            </a>
            <a href="#how" onClick={(e) => handleAnchorClick(e, 'how')}>
              Integration
            </a>
            <a href="#testimonials" onClick={(e) => handleAnchorClick(e, 'testimonials')}>
              Customers
            </a>
          </nav>

          <div className="header-actions">
            <ThemeToggle />
            <button className="btn btn-ghost" type="button">
              Log In
            </button>
            <button className="btn btn-primary" type="button">
              Deploy Workspace
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="shell hero-shell">
            <div className="hero-copy">
              <span className="hero-pill">Built for serious student teams</span>
              <span className="hero-kicker">Planning, ownership, and momentum in one workspace</span>
              <h1>Group projects, without the chaos.</h1>
              <p className="hero-text">
                A polished collaboration workspace for college teams that need clarity fast. Plan the work, see who owns what, and keep every deliverable moving without the last-night confusion.
              </p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="#solution" onClick={(e) => handleAnchorClick(e, 'solution')}>
                  Start a Project →
                </a>
                <a className="btn btn-secondary" href="#solution" onClick={(e) => handleAnchorClick(e, 'solution')}>
                  Explore the Flow
                </a>
              </div>
              <div className="hero-proof">
                <div className="proof-card">
                  <strong>84%</strong>
                  <span>Say group work feels unfair.</span>
                </div>
                <div className="proof-card">
                  <strong>Live</strong>
                  <span>Shared board, chat, and team visibility.</span>
                </div>
                <div className="proof-card">
                  <strong>Smart</strong>
                  <span>AI-assisted task routing and role balance.</span>
                </div>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="hero-visual-frame">
                <div className="hero-console">
                  <div className="hero-console-head">
                    <span className="hero-console-status">Workspace Preview</span>
                    <span className="hero-console-title">Sprint Overview</span>
                  </div>
                  <div className="hero-console-grid">
                    <div className="console-metric">
                      <strong>04</strong>
                      <span>Active members</span>
                    </div>
                    <div className="console-metric">
                      <strong>12</strong>
                      <span>Tasks in flight</span>
                    </div>
                    <div className="console-metric">
                      <strong>03</strong>
                      <span>AI suggestions</span>
                    </div>
                    <div className="console-metric">
                      <strong>02D</strong>
                      <span>Until review</span>
                    </div>
                  </div>
                  <div className="hero-console-lanes">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="hero-console-feed">
                    <div>Research deck assigned to the teammate with the strongest matching focus.</div>
                    <div>Contribution view updated after the latest sprint handoff.</div>
                    <div>Deadline sync pushed to the full workspace in real time.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 01: Problem */}
        <section className="section" id="problem">
          <div className="shell">
            <div className="section-heading">
              <span className="section-label">01 // Why teams break</span>
              <h2>Why group projects usually suck</h2>
              <p>Most student teams fall apart because nobody knows what the other person is actually doing.</p>
            </div>
            <div className="card-grid four-col">
              <article className="feature-card">
                <div className="icon-badge">01</div>
                <h3>One Person Does Everything</h3>
                <p>You know exactly what I mean. One person ends up carrying the whole team at 3 AM.</p>
              </article>
              <article className="feature-card">
                <div className="icon-badge">02</div>
                <h3>Missed Deadlines</h3>
                <p>We forget stuff until the night before it's due. It happens.</p>
              </article>
              <article className="feature-card">
                <div className="icon-badge">03</div>
                <h3>Who Did What?</h3>
                <p>When the professor asks who wrote which part, nobody remembers. Grading becomes a guessing game.</p>
              </article>
              <article className="feature-card">
                <div className="icon-badge">04</div>
                <h3>"I thought you were doing that"</h3>
                <p>Tasks get completely forgotten because we assume someone else claimed it.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Section 02: Solution */}
        <section className="section" id="solution">
          <div className="shell">
            <div className="section-heading">
              <span className="section-label">02 // What changes</span>
              <h2>Built to actually get work done</h2>
            </div>
            <div className="card-grid two-col">
              <article className="feature-card">
                <div className="icon-badge">📋</div>
                <h3>Simple Task Board</h3>
                <p>A basic To-Do board that updates for everyone. Stop asking in the group chat if the intro is done.</p>
              </article>
              <article className="feature-card">
                <div className="icon-badge">📊</div>
                <h3>Contribution Graph</h3>
                <p>A clear log of who finished what. Useful for proving to the TA that you actually did work.</p>
              </article>
              <article className="feature-card">
                <div className="icon-badge">⏰</div>
                <h3>Countdown Clock</h3>
                <p>A giant deadline timer right on the dashboard. Stressful, but it keeps us moving.</p>
              </article>
              <article className="feature-card">
                <div className="icon-badge">💬</div>
                <h3>Project Chat</h3>
                <p>A place to talk about the project without it getting buried under memes in your iMessage group.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Section 03: How it fits together */}
        <section className="section" id="how">
          <div className="shell">
            <div className="section-heading">
              <span className="section-label">03 // How it fits together</span>
              <h2>How the workflow snaps together</h2>
              <p>CollabSpace is still simple at heart. The difference is that the system now feels more intentional, more guided, and more premium.</p>
            </div>
            <div className="card-grid three-col">
              <article className="step-card">
                <div className="icon-badge">01</div>
                <h3>Open a workspace</h3>
                <p>Create the squad, invite your teammates, and turn a messy assignment into one shared operating table.</p>
              </article>
              <article className="step-card">
                <div className="icon-badge">02</div>
                <h3>Route the work</h3>
                <p>Push tasks into the board, let the system assign intelligently, and keep deadlines visible from day one.</p>
              </article>
              <article className="step-card">
                <div className="icon-badge">03</div>
                <h3>Track the output</h3>
                <p>Use the board, chat, and contribution view to see what is moving, what is blocked, and who is carrying momentum.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Section 04: Experience Principles */}
        <section className="section" id="testimonials">
          <div className="shell">
            <div className="section-heading">
              <span className="section-label">04 // Experience principles</span>
              <h2>A landing page that feels stronger, not louder</h2>
              <p>The goal is a more original product identity: cleaner than an agency portfolio, more alive than a basic SaaS template, and still easy to trust.</p>
            </div>
            <div className="card-grid three-col">
              <article className="testimonial-card">
                <p>Clear hierarchy, stronger spacing, and better product framing so the first impression feels intentional.</p>
                <strong>Editorial structure</strong>
                <span>Inspired by premium product sites</span>
              </article>
              <article className="testimonial-card">
                <p>Clean and predictable flow that guides attention instead of shouting for it, with instant clarity and response.</p>
                <strong>Purposeful elegance</strong>
                <span>Lightweight, stable, fast</span>
              </article>
              <article className="testimonial-card">
                <p>Layered visuals that feel modern and interactive without turning the product into a clone of any one reference site.</p>
                <strong>Original polish</strong>
                <span>Adapted to your brand</span>
              </article>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="section cta-section">
          <div className="shell">
            <div className="cta-panel">
              <h2>Let's build something cool</h2>
              <p>Set up your team's workspace and try out CollabSpace for your next big assignment.</p>
              <div className="cta-actions">
                <button className="btn btn-primary" type="button">
                  Create Workspace →
                </button>
                <button className="btn btn-secondary" type="button">
                  Log In
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="shell footer-shell">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <img
                src={logoImg}
                alt="CollabSpace Logo"
                style={{
                  height: '32px',
                  width: 'auto',
                  transform: 'scale(2.5)',
                  transformOrigin: 'left center',
                  marginRight: '25px',
                }}
              />
              <h3 style={{ margin: 0, zIndex: 1, position: 'relative' }}>CollabSpace</h3>
            </div>
            <p>Systematizing student collaboration.</p>
          </div>
          <div className="footer-links">
            <a href="#problem" onClick={(e) => handleAnchorClick(e, 'problem')}>
              Architecture
            </a>
            <a href="#solution" onClick={(e) => handleAnchorClick(e, 'solution')}>
              Features
            </a>
            <a href="#how" onClick={(e) => handleAnchorClick(e, 'how')}>
              Integration
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
